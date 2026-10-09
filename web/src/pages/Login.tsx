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
    <div className="auth-bg min-h-full flex items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-[380px] bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-7 space-y-5 shadow-2xl"
      >
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg flex items-center justify-center font-bold text-white text-xl">
            H
          </div>
          <h1 className="text-xl font-semibold text-white">Headscale · Web UI</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            使用管理员分配的账号登录。首次部署请用环境变量{" "}
            <code className="text-brand-400">WEBUI_BOOTSTRAP_ADMIN</code> 创建管理员。
          </p>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-300">用户名</label>
          <input
            className="focus-ring w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-300">密码</label>
          <input
            type="password"
            className="focus-ring w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-brand-600 hover:bg-brand-500 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {busy ? t("Signing in…") : t("Sign in")}
        </button>
      </form>
    </div>
  );
}
