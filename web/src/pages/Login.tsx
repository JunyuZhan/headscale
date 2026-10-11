import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { auth, type AuthConfig } from "../api/client";
import { useI18n } from "../i18n";
import TurnstileWidget from "../components/TurnstileWidget";

export default function Login({ onLogin }: { onLogin: () => void }) {
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cfg, setCfg] = useState<AuthConfig | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [resetSignal, setResetSignal] = useState(0);
  const navigate = useNavigate();

  // Fetch whether Turnstile is required + its public site key / action. Any
  // failure falls back to "disabled" so a backend outage doesn't hard-lock the
  // page (the config endpoint is same-origin and cheap).
  useEffect(() => {
    auth
      .config()
      .then(setCfg)
      .catch(() =>
        setCfg({
          turnstile_enabled: false,
          turnstile_site_key: "",
          turnstile_action: "login",
        }),
      );
  }, []);

  const requiresTurnstile = cfg?.turnstile_enabled === true;
  const configLoading = cfg === null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (requiresTurnstile && !turnstileToken) {
      setError(t("Human verification failed, please try again"));
      return;
    }
    setBusy(true);
    try {
      await auth.login(
        username.trim(),
        password,
        requiresTurnstile ? turnstileToken : undefined,
      );
      onLogin();
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
      // The token is single-use: drop it and force a fresh challenge so the
      // spent token is never replayed on the next attempt.
      setTurnstileToken("");
      if (requiresTurnstile) setResetSignal((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = !busy && !configLoading;

  return (
    <div className="min-h-full flex">
      {/* Brand panel (Brex "carbon" surface, hidden on small screens). */}
      <div className="hidden md:flex md:w-[46%] lg:w-1/2 bg-carbon text-paper flex-col justify-between p-12 lg:p-16">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-ember flex items-center justify-center font-semibold text-paper text-lg">
            H
          </div>
          <span className="text-lg font-semibold tracking-heading">Headscale</span>
          <span className="text-sm text-steel">Web UI</span>
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl lg:text-4xl font-semibold tracking-heading leading-tight">
            {t("Sign in to your network console")}
          </h1>
          <p className="text-[15px] leading-relaxed text-steel max-w-md">
            {t("Secure, self-hosted Tailscale control plane")}
          </p>
        </div>

        <div className="flex items-center gap-2 text-[12px] text-steel">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-ember" />
          {t("Protected by Cloudflare Turnstile")}
        </div>
      </div>

      {/* Form panel. */}
      <div className="flex-1 flex items-center justify-center bg-fog p-6">
        <form
          onSubmit={submit}
          className="w-full max-w-[400px] bg-paper border border-mist rounded-2xl p-8 space-y-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
        >
          {/* Compact brand mark for small screens (panel hidden there). */}
          <div className="flex md:hidden items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-ember flex items-center justify-center font-semibold text-paper text-base">
              H
            </div>
            <span className="text-base font-semibold tracking-heading">
              Headscale · Web UI
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] text-graphite">用户名</label>
            <input
              className="focus-ring w-full bg-paper border border-mist rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-steel"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] text-graphite">密码</label>
            <input
              type="password"
              className="focus-ring w-full bg-paper border border-mist rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-steel"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {requiresTurnstile && cfg && (
            <div className="space-y-2">
              <span className="text-[13px] text-graphite">
                {t("Complete the security check to continue")}
              </span>
              <TurnstileWidget
                siteKey={cfg.turnstile_site_key}
                action={cfg.turnstile_action}
                onVerify={setTurnstileToken}
                onError={() =>
                  setError(t("Human verification failed, please try again"))
                }
                resetSignal={resetSignal}
              />
            </div>
          )}

          {error && <div className="text-sm text-[#a32d2d]">{error}</div>}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-ember hover:bg-ember-600 text-paper py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {busy
              ? t("Signing in…")
              : configLoading
                ? t("Loading…")
                : t("Sign in")}
          </button>

          <p className="text-[12px] leading-[1.6] text-steel">
            使用管理员分配的账号登录。首次部署请用环境变量{" "}
            <code className="font-mono text-[12px] bg-fog text-ink px-1.5 py-0.5 rounded-md">
              WEBUI_BOOTSTRAP_ADMIN
            </code>{" "}
            创建管理员。
          </p>
        </form>
      </div>
    </div>
  );
}
