import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api, type Me } from "../api/client";

export default function Dashboard() {
  const me = useOutletContext<Me>();
  const [stats, setStats] = useState<{
    nodes: number;
    users?: number;
    keys: number;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const calls: Promise<unknown>[] = [api.listNodes(), api.listPreAuthKeys()];
    if (me.role === "admin") calls.push(api.listUsers());
    Promise.all(calls)
      .then(([n, k, u]) =>
        setStats({
          nodes: (n as { nodes: unknown[] }).nodes.length,
          keys: (k as { preAuthKeys: unknown[] }).preAuthKeys.length,
          users: u
            ? (u as { users: unknown[] }).users.length
            : undefined,
        }),
      )
      .catch((e) => setError(String(e.message ?? e)));
  }, [me.role]);

  const cards = [
    { label: "Nodes", value: stats?.nodes },
    ...(me.role === "admin"
      ? [{ label: "Users", value: stats?.users }]
      : []),
    { label: "Pre-auth keys", value: stats?.keys },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-6">Overview</h1>
      {error && <div className="text-red-400 mb-4">{error}</div>}
      <div className="grid grid-cols-3 gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="bg-slate-900 border border-slate-800 rounded-lg p-5"
          >
            <div className="text-sm text-slate-400">{c.label}</div>
            <div className="text-3xl font-bold text-white mt-1">
              {c.value ?? "—"}
            </div>
          </div>
        ))}
      </div>
      <p className="text-slate-400 text-sm mt-6">
        {me.role === "admin"
          ? "Use the sidebar to manage nodes, users, pre-auth keys and the ACL policy."
          : "Use “My devices” to view your devices and generate a join key."}
      </p>
    </div>
  );
}
