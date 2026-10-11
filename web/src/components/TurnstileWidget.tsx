import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";

// React wrapper around Cloudflare Turnstile (explicit render mode). Loads the
// Turnstile script on demand, renders a widget bound to `action`, and reports
// the one-time token via `onVerify`. Because a token is single-use, the parent
// bumps `resetSignal` (e.g. after a failed submit) to force a fresh challenge.

declare global {
  interface Window {
    turnstile?: TurnstileAPI;
  }
}

interface TurnstileAPI {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  ready: (cb: () => void) => void;
}

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve();
      return;
    }
    const existing = document.getElementById(
      SCRIPT_ID,
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("turnstile script load error")),
      );
      return;
    }
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = SCRIPT_SRC;
    // Dynamic scripts are async by default; do NOT set defer — Cloudflare's
    // explicit-render mode requires calling turnstile.render() directly once
    // the script's load event fires, and using turnstile.ready() together with
    // async/defer throws and prevents the widget from ever rendering.
    s.async = true;
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () =>
      reject(new Error("turnstile script load error")),
    );
    document.head.appendChild(s);
  });
}

interface Props {
  siteKey: string;
  action: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  // Changing this value resets the widget to issue a fresh token.
  resetSignal?: number;
}

export default function TurnstileWidget({
  siteKey,
  action,
  onVerify,
  onExpire,
  onError,
  resetSignal,
}: Props) {
  const { t } = useI18n();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Keep latest callbacks in refs so the render effect doesn't need them as
  // dependencies (and won't re-render the widget on every parent render).
  const cbRef = useRef(onVerify);
  const expRef = useRef(onExpire);
  const errRef = useRef(onError);
  cbRef.current = onVerify;
  expRef.current = onExpire;
  errRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => !cancelled && setReady(true))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !hostRef.current) return;
    const ts = window.turnstile;
    if (!ts) return;
    // Explicit render mode: the loadScript() promise only resolves after the
    // api.js `load` event, so `window.turnstile.render` is guaranteed available
    // here. Do NOT wrap in turnstile.ready() — that throws when the script tag
    // is async/defer and would stop the widget from rendering.
    hostRef.current.innerHTML = "";
    const id = ts.render(hostRef.current, {
      sitekey: siteKey,
      action,
      // Pin the widget to the light theme: the default ("auto") follows the
      // visitor's OS colour scheme, which made Turnstile render its dark skin
      // inside our always-light form card.
      theme: "light",
      callback: (token: string) => cbRef.current(token),
      "expired-callback": () => expRef.current?.(),
      "error-callback": () => errRef.current?.(),
    });
    widgetIdRef.current = id;
    return () => {
      try {
        if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
      } catch {
        /* ignore */
      }
    };
  }, [ready, siteKey, action]);

  // Parent bumped resetSignal -> force a new challenge so the spent token isn't
  // replayed.
  useEffect(() => {
    if (!resetSignal) return;
    try {
      if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
    } catch {
      /* ignore */
    }
  }, [resetSignal]);

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-2 py-2">
        <span className="text-[12px] text-[color:var(--danger)]">
          {t("Human verification failed, please try again")}
        </span>
        <button
          type="button"
          onClick={() => {
            setLoadError(false);
            setReady(false);
            loadScript()
              .then(() => setReady(true))
              .catch(() => setLoadError(true));
          }}
          className="text-[12px] text-[color:var(--ember-text)] hover:text-ember-600 underline underline-offset-2"
        >
          {t("Refresh")}
        </button>
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      className="cf-turnstile flex justify-center"
      aria-label="Cloudflare Turnstile"
    />
  );
}
