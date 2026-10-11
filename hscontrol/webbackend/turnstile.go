package webbackend

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Cloudflare Turnstile integration.
//
// The verifier is intentionally fail-closed: any error (network failure,
// malformed response, action/hostname mismatch, missing token) is treated as a
// failed challenge. A nil *TurnstileVerifier means Turnstile is disabled and
// Verify is a no-op, so callers can keep a single code path:
//
//	if s.turnstile != nil {
//	    if err := s.turnstile.Verify(ctx, token, ip); err != nil { ... }
//	}
//
// Reuse the same sclink.dev Cloudflare zone as the SecureLink console: the
// site key / secret are shared, and the allowed hostname list just needs to
// include hs.sclink.dev in addition to console.sclink.dev.

const (
	TurnstileSiteverifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
	DefaultTurnstileAction = "login"
	turnstileMaxTokenLen   = 2048
	TurnstileTimeout       = 10 * time.Second
)

// TurnstileVerifier verifies a Turnstile challenge token. A nil verifier means
// Turnstile is not configured; Verify is then a no-op.
type TurnstileVerifier interface {
	Verify(ctx context.Context, token, remoteIP string) error
}

type turnstileVerifier struct {
	secret    string
	action    string
	hostnames []string
	client    *http.Client
}

// NewTurnstileVerifier builds a verifier. Turnstile is considered disabled (and
// a nil verifier returned) when either the secret or the allowed hostname list
// is empty — the hostname allow-list is the hard on/off switch so an operator
// can't accidentally enable verification without naming the protected host.
func NewTurnstileVerifier(secret, action string, hostnames []string, client *http.Client) TurnstileVerifier {
	if strings.TrimSpace(secret) == "" || len(hostnames) == 0 {
		return nil
	}
	if strings.TrimSpace(action) == "" {
		action = DefaultTurnstileAction
	}
	if client == nil {
		client = &http.Client{Timeout: TurnstileTimeout}
	}
	return &turnstileVerifier{
		secret:    strings.TrimSpace(secret),
		action:    action,
		hostnames: hostnames,
		client:    client,
	}
}

// Verify validates a Turnstile token against Cloudflare, checking three things:
//  1. success == true (the challenge passed),
//  2. action matches the expected action (binds the token to this flow),
//  3. hostname is in the allowed list (binds the token to our domain).
func (v *turnstileVerifier) Verify(ctx context.Context, token, remoteIP string) error {
	if strings.TrimSpace(token) == "" {
		return fmt.Errorf("turnstile token missing")
	}
	if len(token) > turnstileMaxTokenLen {
		return fmt.Errorf("turnstile token too long")
	}

	form := url.Values{}
	form.Set("secret", v.secret)
	form.Set("response", token)
	if strings.TrimSpace(remoteIP) != "" {
		form.Set("remoteip", strings.TrimSpace(remoteIP))
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, TurnstileSiteverifyURL, strings.NewReader(form.Encode()))
	if err != nil {
		return fmt.Errorf("turnstile request build: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := v.client.Do(req)
	if err != nil {
		// Fail closed: if we can't reach Cloudflare we must not let logins
		// through unverified.
		return fmt.Errorf("turnstile verify request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("turnstile read response: %w", err)
	}

	var out struct {
		Success     bool     `json:"success"`
		Action      string   `json:"action"`
		Hostname    string   `json:"hostname"`
		ChallengeTS string   `json:"challenge_ts"`
		ErrorCodes  []string `json:"error-codes"`
	}
	if err := json.Unmarshal(body, &out); err != nil {
		return fmt.Errorf("turnstile decode response: %w", err)
	}

	if !out.Success {
		return fmt.Errorf("turnstile verification failed: %v", out.ErrorCodes)
	}
	if out.Action != v.action {
		return fmt.Errorf("turnstile action mismatch: got %q want %q", out.Action, v.action)
	}
	if !turnstileHostnameAllowed(v.hostnames, out.Hostname) {
		return fmt.Errorf("turnstile hostname mismatch: %q not in allowed set", out.Hostname)
	}
	return nil
}

func turnstileHostnameAllowed(allowed []string, h string) bool {
	for _, a := range allowed {
		if h == a {
			return true
		}
	}
	return false
}
