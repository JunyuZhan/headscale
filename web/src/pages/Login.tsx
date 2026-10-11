import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../api/client";
import { useI18n } from "../i18n";

export default function Login({ onLogin }: { onLogin: () => void }) {
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await auth.login(username.trim(), password);
      onLogin();
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full bg-fog flex items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-[380px] bg-paper border border-mist rounded-xl p-8 space-y-6"
      >
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-ink flex items-center justify-center font-semibold text-paper text-xl">
            H
          </div>
          <h1 className="text-2xl tracking-heading font-semibold text-ink">
            Headscale · Web UI
          </h1>
          <p className="text-[13px] leading-[1.6] text-graphite">
            使用管理员分配的账号登录。首次部署请用环境变量{" "}
            <code className="font-mono text-[12px] bg-fog text-ink px-1.5 py-0.5 rounded-md">
              WEBUI_BOOTSTRAP_ADMIN
            </code>{" "}
            创建管理员。
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] text-graphite">用户名</label>
          <input
            className="focus-ring w-full bg-paper border border-mist rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-steel"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] text-graphite">密码</label>
          <input
            type="password"
            className="focus-ring w-full bg-paper border border-mist rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-steel"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <div className="text-sm text-[#a32d2d]">{error}</div>}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-ember hover:bg-ember-600 text-paper py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
        >
          {busy ? t("Signing in…") : t("Sign in")}
        </button>
      </form>
    </div>
  );
}
