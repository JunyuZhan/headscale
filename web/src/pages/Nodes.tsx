import { useCallback, useEffect, useState } from "react";
import { api, type Node } from "../api/client";

function fmt(ts?: string): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleString();
}

export default function Nodes() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setBusy(true);
    api
      .listNodes()
      .then((r) => setNodes(r.nodes))
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-white">Nodes</h1>
        <button
          onClick={load}
          disabled={busy}
          className="bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
      {error && <div className="text-red-400 mb-3 text-sm">{error}</div>}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-slate-300">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">Addresses</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Last seen</th>
              <th className="text-left p-3">Tags</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((n) => (
              <tr key={n.id} className="border-t border-slate-800">
                <td className="p-3 text-slate-200">{n.name}</td>
                <td className="p-3 text-slate-400">{n.user?.name ?? "—"}</td>
                <td className="p-3 text-slate-400 font-mono text-xs">
                  {(n.addresses ?? []).join(", ") || "—"}
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      n.connected
                        ? "bg-emerald-900 text-emerald-300"
                        : "bg-slate-700 text-slate-300"
                    }`}
                  >
                    {n.connected ? "online" : "offline"}
                  </span>
                </td>
                <td className="p-3 text-slate-400 text-xs">{fmt(n.lastSeen)}</td>
                <td className="p-3 text-slate-400 text-xs">
                  {(n.tags ?? []).join(" ") || "—"}
                </td>
                <td className="p-3 space-x-2 whitespace-nowrap">
                  <button
                    className="text-brand-500 hover:underline"
                    onClick={() => {
                      const name = window.prompt("New name", n.name);
                      if (name)
                        run("Rename failed", () => api.renameNode(n.id, name));
                    }}
                  >
                    Rename
                  </button>
                  <button
                    className="text-brand-500 hover:underline"
                    onClick={() => {
                      const tags = window.prompt(
                        "Tags (space separated, e.g. tag:server)",
                        (n.tags ?? []).join(" "),
                      );
                      if (tags !== null)
                        run("Set tags failed", () =>
                          api.setNodeTags(
                            n.id,
                            tags.split(/\s+/).filter(Boolean),
                          ),
                        );
                    }}
                  >
                    Tags
                  </button>
                  <button
                    className="text-amber-400 hover:underline"
                    onClick={() =>
                      run("Expire failed", () => api.expireNode(n.id))
                    }
                  >
                    Expire
                  </button>
                  <button
                    className="text-red-400 hover:underline"
                    onClick={() => {
                      if (window.confirm(`Delete node ${n.name}?`))
                        run("Delete failed", () => api.deleteNode(n.id));
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {nodes.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-slate-500">
                  No nodes
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
