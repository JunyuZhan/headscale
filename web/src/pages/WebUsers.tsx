import { useCallback, useEffect, useState, type FormEvent } from "react";
import { admin, type User, type WebUser } from "../api/client";
import { useI18n } from "../i18n";

export default function WebUsers() {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<WebUser[]>([]);
  const [hsUsers, setHsUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  // create form
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [hsUser, setHsUser] = useState("");

  const load = useCallback(() => {
    admin
      .webUsers()
      .then(setAccounts)
      .catch((e) => setError(e.message));
    // Headscale users are needed to bind a role=user console account.
    fetch("/ui/api/proxy/user", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((d: { users: User[] }) => setHsUsers(d.users ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => load(), [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setOk("");
    if (username.trim().length < 1) return;
    if (password.length < 6) {
      setError(t("Password must be at least 6 characters"));
      return;
    }
    if (role === "user" && !hsUser) {
      setError(t("Pick a Headscale user to bind"));
      return;
    }
    try {
      await admin.createWebUser({
        username: username.trim(),
        password,
        email: email.trim(),
        headscale_user: role === "user" ? hsUser : "",
        role,
      });
      setOk(`${t("Created")}: ${username.trim()}`);
      setUsername("");
      setPassword("");
      setEmail("");
      setHsUser("");
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const resetPw = async (id: number, name: string) => {
    const np = window.prompt(`${t("New password")} (${name})`);
    if (!np) return;
    if (np.length < 6) {
      setError(t("Password must be at least 6 characters"));
      return;
    }
    setError("");
    setOk("");
    try {
      await admin.resetWebUserPassword(id, np);
      setOk(`${t("Password reset")}: ${name}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const del = async (id: number, name: string) => {
    if (!window.confirm(`${t("Delete account")} ${name}？`)) return;
    setError("");
    setOk("");
    try {
      await admin.deleteWebUser(id);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">{t("Console accounts")}</h1>
      <p className="text-sm text-slate-400 mt-1 mb-5">
        {t(
          "Login accounts for this web console (with passwords). Not the same as Headscale users.",
        )}
      </p>

      {error && <div className="text-red-400 mb-3 text-sm">{error}</div>}
      {ok && <div className="text-emerald-400 mb-3 text-sm">{ok}</div>}

      <form onSubmit={create} className="card p-4 mb-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {t("Account name")}
            </label>
            <input
              className="focus-ring w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
              placeholder="alice"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {t("Password")}
            </label>
            <input
              type="password"
              className="focus-ring w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
              placeholder={t("at least 6 characters")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {t("Email")}
            </label>
            <input
              className="focus-ring w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t("Role")}</label>
            <select
              className="focus-ring w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "user")}
            >
              <option value="user">{t("user")}</option>
              <option value="admin">{t("admin")}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {t("Bind to Headscale user")}
            </label>
            <select
              className="focus-ring w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
              value={hsUser}
              disabled={role === "admin"}
              onChange={(e) => setHsUser(e.target.value)}
            >
              <option value="">{role === "admin" ? t("(admin sees all)") : "—"}</option>
              {hsUsers.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name}
                  {u.displayName ? ` (${u.displayName})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {t("Create")}
          </button>
        </div>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/60 text-slate-400 text-left">
              <th className="p-3 font-medium">{t("Account name")}</th>
              <th className="p-3 font-medium">{t("Role")}</th>
              <th className="p-3 font-medium">{t("Bound Headscale user")}</th>
              <th className="p-3 font-medium">{t("Email")}</th>
              <th className="p-3 font-medium text-right">{t("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr
                key={a.id}
                className="border-t border-slate-800 hover:bg-slate-800/40 transition-colors"
              >
                <td className="p-3 text-slate-200 font-medium">{a.username}</td>
                <td className="p-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[11px] ${
                      a.role === "admin"
                        ? "bg-brand-500/15 text-brand-300"
                        : "bg-slate-500/15 text-slate-300"
                    }`}
                  >
                    {t(a.role)}
                  </span>
                </td>
                <td className="p-3 text-slate-400">{a.headscale_user || "—"}</td>
                <td className="p-3 text-slate-400">{a.email || "—"}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => resetPw(a.id, a.username)}
                    className="text-amber-300 hover:bg-amber-500/15 px-2 py-1 rounded-md text-xs font-medium transition-colors"
                  >
                    {t("Reset password")}
                  </button>
                  <button
                    onClick={() => del(a.id, a.username)}
                    className="text-red-300 hover:bg-red-500/15 px-2 py-1 rounded-md text-xs font-medium transition-colors"
                  >
                    {t("Delete")}
                  </button>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-500">
                  {t("No accounts")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 mt-4">
        {t(
          "Tip: a role=user account can only see and manage devices of its bound Headscale user.",
        )}
      </p>
    </div>
  );
}
