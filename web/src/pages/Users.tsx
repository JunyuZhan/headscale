import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, type User } from "../api/client";
import { useI18n } from "../i18n";

export default function Users() {
  const { t } = useI18n();
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api
      .listUsers()
      .then((r) => setUsers(r.users))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => load(), [load]);

  const run = async (msg: string, fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
      load();
    } catch (e) {
      setError(`${msg}: ${(e as Error).message}`);
    }
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    await run(t("Create failed"), () =>
      api.createUser(value, displayName.trim(), email.trim()),
    );
    setName("");
    setDisplayName("");
    setEmail("");
  };

  return (
    <div>
      <h1 className="text-[28px] leading-[1.3] tracking-heading font-semibold text-ink">{t("Users")}</h1>
      <p className="text-sm text-graphite mt-1 mb-5">
        {t("Headscale users — each maps to a set of joinable devices.")}
      </p>

      {error && <div className="text-[color:var(--danger)] mb-3 text-sm">{error}</div>}

      <form onSubmit={create} className="card p-4 mb-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-graphite mb-1">
              {t("New user name")}
            </label>
            <input
              className="focus-ring w-full bg-paper border border-mist rounded-xl px-3 py-2 text-sm text-ink"
              placeholder="owner"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-[11px] text-steel mt-1">
              {t("Machine id used in ACLs and join commands")}
            </p>
          </div>
          <div>
            <label className="block text-xs text-graphite mb-1">
              {t("Display name")}
            </label>
            <input
              className="focus-ring w-full bg-paper border border-mist rounded-xl px-3 py-2 text-sm text-ink"
              placeholder={t("e.g. real name / nickname")}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-graphite mb-1">
              {t("Email")}
            </label>
            <input
              className="focus-ring w-full bg-paper border border-mist rounded-xl px-3 py-2 text-sm text-ink"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-ember hover:bg-ember-600 text-[color:var(--on-ember)] px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            {t("Create")}
          </button>
        </div>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-fog text-graphite text-left">
              <th className="p-3 font-medium">{t("Name")}</th>
              <th className="p-3 font-medium">{t("Display name")}</th>
              <th className="p-3 font-medium">{t("Email")}</th>
              <th className="p-3 font-medium text-right">{t("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="border-t border-mist hover:bg-fog transition-colors"
              >
                <td className="p-3 text-ink font-medium">{u.name}</td>
                <td className="p-3 text-graphite">{u.displayName ?? "—"}</td>
                <td className="p-3 text-graphite">{u.email ?? "—"}</td>
                <td className="p-3 text-right">
                  <button
                    className="text-[color:var(--danger)] hover:bg-[color:var(--danger-bg)] px-2 py-1 rounded-md text-xs font-medium transition-colors"
                    onClick={() => {
                      if (window.confirm(`${t("Delete user")} ${u.name}？`))
                        run(t("Delete failed"), () => api.deleteUser(u.id));
                    }}
                  >
                    {t("Delete")}
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-steel">
                  {t("No users")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
