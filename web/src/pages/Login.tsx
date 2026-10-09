import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../api/client";

export default function Login({ onLogin }: { onLogin: () => void }) {
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
    <div className="min-h-full flex items-center justify-center">
      <form
        onSubmit={submit}
        className="w-96 bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-4"
      >
        <h1 className="text-xl font-semibold text-white">Headscale · Web UI</h1>
        <p className="text-sm text-slate-400">
          使用管理员分配的账号登录。首次部署请用环境变量{" "}
          <code className="text-brand-500">WEBUI_BOOTSTRAP_ADMIN</code> 创建管理员。
        </p>
        <div className="space-y-1">
          <label className="text-sm text-slate-300">用户名</label>
          <input
            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-200"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-300">密码</label>
          <input
            type="password"
            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-200"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-brand-600 hover:bg-brand-500 text-white py-2 rounded-md text-sm font-medium disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
