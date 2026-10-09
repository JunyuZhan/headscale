import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api, type Me } from "../api/client";
import { useI18n } from "../i18n";

export default function Dashboard() {
  const me = useOutletContext<Me>();
  const { t } = useI18n();
  const [stats, setStats] = useState<{
    nodes: number;
    online: number;
    users?: number;
    keys: number;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const calls: Promise<unknown>[] = [api.listNodes(), api.listPreAuthKeys()];
    if (me.role === "admin") calls.push(api.listUsers());
    Promise.all(calls)
      .then(([n, k, u]) => {
        const nodeList = (n as { nodes: { connected?: boolean }[] }).nodes;
        setStats({
          nodes: nodeList.length,
          online: nodeList.filter((x) => x.connected).length,
          keys: (k as { preAuthKeys: unknown[] }).preAuthKeys.length,
          users: u ? (u as { users: unknown[] }).users.length : undefined,
        });
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [me.role]);

  const cards = [
    {
      label: t("Nodes"),
      value: stats?.nodes,
      sub: stats ? `${stats.online} ${t("online")}` : undefined,
      accent: "from-brand-500/20 to-brand-700/5 text-brand-300 border-brand-500/30",
    },
    ...(me.role === "admin"
      ? [
          {
            label: t("Users"),
            value: stats?.users,
            accent:
              "from-emerald-500/15 to-emerald-700/5 text-emerald-300 border-emerald-500/30",
          },
        ]
      : []),
    {
      label: t("Pre-auth keys"),
      value: stats?.keys,
      accent:
        "from-amber-500/15 to-amber-700/5 text-amber-300 border-amber-500/30",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibibold text-white mb-1">{t("Overview")}</h1>
      <p className="text-slate-400 text-sm mb-6">
        {me.role === "admin"
          ? "管理节点、用户、预授权密钥与访问控制策略。"
          : "在「我的设备」中查看你的设备并生成接入密钥。"}
      </p>
      {error && <div className="text-red-400 mb-4">{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-xl border bg-gradient-to-br p-5 ${c.accent}`}
          >
            <div className="text-sm opacity-90">{c.label}</div>
            <div className="text-3xl font-bold text-white mt-1">
              {c.value ?? "—"}
            </div>
            {c.sub && <div className="text-xs mt-1 opacity-80">{c.sub}</div>}
          </div>
        ))}
      </div>

      <div className="mt-6 card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium text-white">网络状态</h2>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              stats && stats.online > 0
                ? "bg-emerald-900/60 text-emerald-300"
                : "bg-slate-700 text-slate-300"
            }`}
          >
            {stats ? `${stats.online}/${stats.nodes} ${t("online")}` : "—"}
          </span>
        </div>
        <p className="text-sm text-slate-400 mt-2">
          {me.role === "admin"
            ? "节点通过预授权密钥或邀请命令接入，成员之间默认隔离，仅可访问被标记为 tag:server 的内网服务器节点。"
            : "你接入的设备会出现在「我的设备」中，可随时生成新的接入密钥或吊销设备。"}
        </p>
      </div>
    </div>
  );
}
