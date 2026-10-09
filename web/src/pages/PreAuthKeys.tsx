import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, type PreAuthKey } from "../api/client";

function toRFC3339(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export default function PreAuthKeys() {
  const [keys, setKeys] = useState<PreAuthKey[]>([]);
  const [newKey, setNewKey] = useState<PreAuthKey | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [user, setUser] = useState("");
  const [reusable, setReusable] = useState(false);
  const [ephemeral, setEphemeral] = useState(false);
  const [expiration, setExpiration] = useState("");
  const [aclTags, setAclTags] = useState("");

  const load = useCallback(() => {
    setBusy(true);
    api
      .listPreAuthKeys()
      .then((r) => setKeys(r.preAuthKeys))
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
    const u = user.trim();
    if (!u) {
      setError("User is required");
      return;
    }
    setError("");
    try {
      const r = await api.createPreAuthKey(
        u,
        reusable,
        ephemeral,
        toRFC3339(expiration),
        aclTags
          .split(/\s+/)
          .map((t) => t.trim())
          .filter(Boolean),
      );
      setNewKey(r.preAuthKey);
      setUser("");
      setExpiration("");
      setAclTags("");
      setReusable(false);
      setEphemeral(false);
      load();
    } catch (e) {
      setError(`Create failed: ${(e as Error).message}`);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-4">Pre-auth keys</h1>
      {error && <div className="text-red-400 mb-3 text-sm">{error}</div>}

      {newKey?.key && (
        <div className="mb-4 bg-emerald-900/40 border border-emerald-700 rounded p-3 text-sm">
          <div className="text-emerald-300 font-medium">New key created</div>
          <code className="block mt-1 break-all text-emerald-200">
            {newKey.key}
          </code>
          <div className="text-emerald-400/70 text-xs mt-1">
            Copy it now — it will not be shown again.
          </div>
        </div>
      )}

      <form
        onSubmit={create}
        className="grid grid-cols-2 gap-3 mb-4 bg-slate-900 border border-slate-800 rounded-lg p-4"
      >
        <input
          className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200"
          placeholder="User name"
          value={user}
          onChange={(e) => setUser(e.target.value)}
        />
        <input
          type="datetime-local"
          className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200"
          value={expiration}
          onChange={(e) => setExpiration(e.target.value)}
        />
        <input
          className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200"
          placeholder="ACL tags (e.g. tag:server)"
          value={aclTags}
          onChange={(e) => setAclTags(e.target.value)}
        />
        <div className="flex items-center gap-4 text-sm text-slate-300">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={reusable}
              onChange={(e) => setReusable(e.target.checked)}
            />
            Reusable
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={ephemeral}
              onChange={(e) => setEphemeral(e.target.checked)}
            />
            Ephemeral
          </label>
        </div>
        <button
          type="submit"
          className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-1.5 rounded text-sm col-span-2"
        >
          Create key
        </button>
      </form>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-slate-300">
            <tr>
              <th className="text-left p-3">ID</th>
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">Reusable</th>
              <th className="text-left p-3">Expiration</th>
              <th className="text-left p-3">Tags</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} className="border-t border-slate-800">
                <td className="p-3 text-slate-200 font-mono text-xs">
                  {k.id}
                </td>
                <td className="p-3 text-slate-400">{k.user ?? "—"}</td>
                <td className="p-3 text-slate-400">{k.reusable ? "yes" : "no"}</td>
                <td className="p-3 text-slate-400 text-xs">
                  {k.expiration ?? "—"}
                </td>
                <td className="p-3 text-slate-400 text-xs">
                  {(k.aclTags ?? []).join(" ") || "—"}
                </td>
                <td className="p-3 space-x-2 whitespace-nowrap">
                  <button
                    className="text-amber-400 hover:underline"
                    onClick={() =>
                      run("Expire failed", () => api.expirePreAuthKey(k.id))
                    }
                  >
                    Expire
                  </button>
                  <button
                    className="text-red-400 hover:underline"
                    onClick={() =>
                      run("Delete failed", () => api.deletePreAuthKey(k.id))
                    }
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-slate-500">
                  No keys
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
