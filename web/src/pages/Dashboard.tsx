import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api, type Me } from "../api/client";
import { useI18n } from "../i18n";
import { useNodeStream } from "../lib/useNodeStream";

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

  const reload = useCallback(() => {
    const calls: Promise<unknown>[] = [api.listNodes(), api.listPreAuthKeys()];
    if (me.role === "admin") calls.push(api.listUsers());
    Promise.all(calls)
      .then(([n, k, u]) => {
        const nodeList = (n as { nodes: { online?: boolean; connected?: boolean }[] }).nodes;
        setStats({
          nodes: nodeList.length,
          online: nodeList.filter((x) => x.online ?? x.connected).length,
          keys: (k as { preAuthKeys: unknown[] }).preAuthKeys.length,
          users: u ? (u as { users: unknown[] }).users.length : undefined,
        });
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [me.role]);

  useEffect(() => reload(), [reload]);

  // Keep the online/total counters live as devices join/leave or flip state.
  useNodeStream(reload, true);

  const cards = [
    {
      label: t("Nodes"),
      value: stats?.nodes,
      sub: stats ? `${stats.online} ${t("online")}` : undefined,
    },
    ...(me.role === "admin"
      ? [{ label: t("Users"), value: stats?.users, sub: undefined as string | undefined }]
      : []),
    {
      label: t("Pre-auth keys"),
      value: stats?.keys,
      sub: undefined as string | undefined,
    },
  ];

  const liveBadge = stats && stats.online > 0;

  return (
    <div>
      <h1 className="text-[36px] leading-[1.21] tracking-heading font-semibold text-ink mb-2">
        {t("Overview")}
      </h1>
      <p className="text-sm text-graphite mb-8 max-w-[640px]">
        {me.role === "admin"
          ? "管理节点、用户、预授权密钥与访问控制策略。"
          : "在「我的设备」中查看你的设备并生成接入密钥。"}
      </p>

      {error && <div className="text-sm text-[#a32d2d] mb-6">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-mist bg-paper p-6">
            <div className="text-[13px] text-graphite">{c.label}</div>
            <div className="text-[36px] leading-none tracking-heading font-semibold text-ink mt-3">
              {c.value ?? "—"}
            </div>
            {c.sub && <div className="text-xs text-pewter mt-2">{c.sub}</div>}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-mist bg-paper p-6 mt-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-ink">网络状态</h2>
          <span
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md font-medium ${
              liveBadge ? "bg-live-soft text-live" : "bg-fog text-graphite"
            }`}
          >
            {liveBadge && (
              <span className="w-1.5 h-1.5 rounded-full bg-live status-pulse" />
            )}
            {stats ? `${stats.online}/${stats.nodes} ${t("online")}` : "—"}
          </span>
        </div>
        <p className="text-[15px] leading-[1.55] text-graphite mt-3 max-w-[640px]">
          {me.role === "admin"
            ? "节点通过预授权密钥或邀请命令接入，成员之间默认隔离，仅可访问被标记为 tag:server 的内网服务器节点。"
            : "你接入的设备会出现在「我的设备」中，可随时生成新的接入密钥或吊销设备。"}
        </p>
      </div>
    </div>
  );
}
