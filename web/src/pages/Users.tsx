import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, type User } from "../api/client";

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setBusy(true);
    api
      .listUsers()
      .then((r) => setUsers(r.users))
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
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
    await run("Create failed", () => api.createUser(value));
    setName("");
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-4">Users</h1>
      {error && <div className="text-red-400 mb-3 text-sm">{error}</div>}
      <form onSubmit={create} className="flex gap-2 mb-4">
        <input
          className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 flex-1"
          placeholder="New user name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="submit"
          className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-1.5 rounded text-sm"
        >
          Create
        </button>
      </form>
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-slate-300">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Display name</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-800">
                <td className="p-3 text-slate-200">{u.name}</td>
                <td className="p-3 text-slate-400">{u.displayName ?? "—"}</td>
                <td className="p-3 text-slate-400">{u.email ?? "—"}</td>
                <td className="p-3">
                  <button
                    className="text-red-400 hover:underline"
                    onClick={() => {
                      if (window.confirm(`Delete user ${u.name}?`))
                        run("Delete failed", () => api.deleteUser(u.id));
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-slate-500">
                  No users
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {busy && <div className="text-slate-500 text-sm mt-2">Loading…</div>}
    </div>
  );
}
