import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { admin, api, type Invite, type Me, type Node } from "../api/client";
import { useI18n } from "../i18n";
import { useNodeStream } from "../lib/useNodeStream";
import AddDeviceModal from "../components/AddDeviceModal";

function StatusDot({ online }: { online: boolean }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`w-2 h-2 rounded-full ${
          online
            ? "bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/60 status-pulse"
            : "bg-slate-500"
        }`}
      />
      <span className={online ? "text-emerald-300" : "text-slate-400"}>
        {online ? t("online") : t("offline")}
      </span>
    </span>
  );
}

function fmt(ts?: string): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleString();
}

export default function Nodes() {
  const { t } = useI18n();
  const me = useOutletContext<Me>();
  const isAdmin = me.role === "admin";
  const [nodes, setNodes] = useState<Node[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showExpired, setShowExpired] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadInvites = useCallback(() => {
    if (!isAdmin) return;
    admin
      .listInvites()
      .then(setInvites)
      .catch(() => {
        /* ledger is admin-only; ignore on error */
      });
  }, [isAdmin]);

  const load = useCallback(() => {
    setBusy(true);
    api
      .listNodes()
      .then((r) => setNodes(r.nodes))
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, []);

  useEffect(() => load(), [load]);
  useEffect(() => loadInvites(), [loadInvites]);

  // Live-update: the backend pushes a signal whenever a node joins/leaves or
  // flips online/offline, so the table refreshes itself without a manual click.
  // Pending invites are reloaded too, so a row moves from "pending" to a real
  // node as soon as the invited device comes online.
  useNodeStream(() => {
    load();
    loadInvites();
  }, true);

  // A pending invite = key still valid AND no node has joined under its
  // hostname yet. Joined nodes are shown in the main table instead.
  const nodeNames = new Set(nodes.map((n) => (n.givenName ?? n.name ?? "").toLowerCase()));
  const pending = invites.filter(
    (iv) =>
      new Date(iv.expires_at).getTime() > Date.now() &&
      !nodeNames.has((iv.hostname || "").toLowerCase()),
  );
  const pendingHostnames = new Set(pending.map((p) => p.hostname));
  const expiredCount = invites.filter(
    (iv) => new Date(iv.expires_at).getTime() <= Date.now(),
  ).length;

  const run = async (msg: string, fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
      load();
    } catch (e) {
      setError(`${msg}: ${(e as Error).message}`);
    }
  };

  const Action = ({
    label,
    onClick,
    tone = "brand",
  }: {
    label: string;
    onClick: () => void;
    tone?: "brand" | "amber" | "red";
  }) => {
    const cls =
      tone === "red"
        ? "text-red-300 hover:bg-red-500/15"
        : tone === "amber"
          ? "text-amber-300 hover:bg-amber-500/15"
          : "text-brand-300 hover:bg-brand-500/15";
    return (
      <button
        onClick={onClick}
        className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${cls}`}
      >
        {label}
      </button>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-white">{t("Nodes")}</h1>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 status-pulse" />
            {t("Live")}
          </span>
          {isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              ＋ {t("Add device")}
            </button>
          )}
          <button
            onClick={() => {
              load();
              loadInvites();
            }}
            disabled={busy}
            className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50 transition-colors"
          >
            {t("Refresh")}
          </button>
        </div>
      </div>
      {error && <div className="text-red-400 mb-3 text-sm">{error}</div>}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/60 text-slate-400 text-left">
              <th className="p-3 font-medium">{t("Name")}</th>
              <th className="p-3 font-medium">{t("User")}</th>
              <th className="p-3 font-medium">{t("Addresses")}</th>
              <th className="p-3 font-medium">{t("Status")}</th>
              <th className="p-3 font-medium">{t("Last seen")}</th>
              <th className="p-3 font-medium">{t("Tags")}</th>
              <th className="p-3 font-medium text-right">{t("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((n) => (
              <tr
                key={n.id}
                className="border-t border-slate-800 hover:bg-slate-800/40 transition-colors"
              >
                <td className="p-3 text-slate-200 font-medium">{n.givenName ?? n.name}</td>
                <td className="p-3 text-slate-400">{n.user?.name ?? "—"}</td>
                <td className="p-3 text-slate-400 font-mono text-xs">
                  {((n.ipAddresses ?? n.addresses) ?? []).join(", ") || "—"}
                </td>
                <td className="p-3">
                  <StatusDot online={!!(n.online ?? n.connected)} />
                </td>
                <td className="p-3 text-slate-400 text-xs">{fmt(n.lastSeen)}</td>
                <td className="p-3 text-slate-400 text-xs">
                  {(n.tags ?? []).join(" ") || "—"}
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <Action
                    label={t("Rename")}
                    onClick={() => {
                      const name = window.prompt(
                        t("New name"),
                        n.givenName ?? n.name,
                      );
                      if (name)
                        run(t("Rename failed"), () => api.renameNode(n.id, name));
                    }}
                  />
                  <Action
                    label={t("Tags")}
                    onClick={() => {
                      const tags = window.prompt(
                        t("Tags (space separated, e.g. tag:server)"),
                        (n.tags ?? []).join(" "),
                      );
                      if (tags !== null)
                        run(t("Set tags failed"), () =>
                          api.setNodeTags(n.id, tags.split(/\s+/).filter(Boolean)),
                        );
                    }}
                  />
                  <Action
                    label={t("Expire")}
                    tone="amber"
                    onClick={() =>
                      run(t("Expire failed"), () => api.expireNode(n.id))
                    }
                  />
                  <Action
                    label={t("Revoke device")}
                    tone="red"
                    onClick={() => {
                      if (
                        window.confirm(
                          `${t("Revoke node")} ${n.givenName ?? n.name}？`,
                        )
                      )
                        run(t("Delete failed"), () => api.deleteNode(n.id));
                    }}
                  />
                </td>
              </tr>
            ))}
            {pending.map((iv) => (
              <tr
                key={`inv-${iv.id}`}
                className="border-t border-slate-800 bg-slate-900/40"
              >
                <td className="p-3 text-slate-400 italic">
                  {iv.hostname || iv.device_desc || "—"}
                </td>
                <td className="p-3 text-slate-500">{iv.target_user || "—"}</td>
                <td className="p-3 text-slate-600 font-mono text-xs">—</td>
                <td className="p-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full border border-amber-400/70" />
                    <span className="text-amber-300/90">{t("Pending join")}</span>
                  </span>
                </td>
                <td className="p-3 text-slate-500 text-xs">—</td>
                <td className="p-3 text-slate-600 text-xs">—</td>
                <td className="p-3 text-right text-slate-500 text-xs whitespace-nowrap">
                  {t("Invite sent")} · {fmt(iv.expires_at).slice(0, 10)}
                </td>
              </tr>
            ))}
            {nodes.length === 0 && pending.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-500">
                  {t("No nodes")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAdmin && invites.length > 0 && (
        <div className="card p-4 mt-5">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <h3 className="text-sm font-medium text-slate-200">
                {t("Invite record")}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t("Invited, not yet joined — the device will appear above once it joins.")}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {expiredCount > 0 && (
                <>
                  <button
                    onClick={() => setShowExpired((v) => !v)}
                    className="text-xs text-slate-400 border border-slate-700 rounded-lg px-2.5 py-1.5 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                  >
                    {showExpired
                      ? t("Hide expired")
                      : `${t("Show expired")} (${expiredCount})`}
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`${t("Clear expired invites")}？`))
                        run(t("Clear failed"), () => admin.purgeExpiredInvites());
                    }}
                    className="text-xs text-amber-300 border border-amber-500/40 rounded-lg px-2.5 py-1.5 hover:bg-amber-500/15 transition-colors"
                  >
                    {t("Clear expired")}
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="overflow-auto mt-3">
            <table className="w-full text-sm">
              <thead className="text-slate-400">
                <tr className="text-left">
                  <th className="py-1 pr-3">{t("Applicant")}</th>
                  <th className="py-1 pr-3">{t("Device")}</th>
                  <th className="py-1 pr-3">{t("Organization")}</th>
                  <th className="py-1 pr-3">{t("Node name")}</th>
                  <th className="py-1 pr-3">{t("Target user")}</th>
                  <th className="py-1 pr-3">{t("By")}</th>
                  <th className="py-1 pr-3">{t("Expires")}</th>
                  <th className="py-1 pr-3">{t("Status")}</th>
                  <th className="py-1 text-right">{t("Actions")}</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {invites
                  .filter(
                    (iv) =>
                      showExpired ||
                      new Date(iv.expires_at).getTime() > Date.now(),
                  )
                  .map((iv) => {
                    const expired =
                      new Date(iv.expires_at).getTime() <= Date.now();
                    const label = expired
                      ? t("已过期")
                      : pendingHostnames.has(iv.hostname)
                        ? t("Pending join")
                        : t("已使用");
                    return (
                      <tr
                        key={iv.id}
                        className={`border-t border-slate-800 ${
                          expired ? "opacity-50" : ""
                        }`}
                      >
                        <td className="py-1 pr-3">{iv.applicant || "—"}</td>
                        <td className="py-1 pr-3">{iv.device_desc || "—"}</td>
                        <td className="py-1 pr-3">{iv.org || "—"}</td>
                        <td className="py-1 pr-3">{iv.hostname || "—"}</td>
                        <td className="py-1 pr-3">{iv.target_user}</td>
                        <td className="py-1 pr-3">{iv.created_by}</td>
                        <td className="py-1 pr-3 whitespace-nowrap">
                          {fmt(iv.expires_at).slice(0, 16)}
                        </td>
                        <td className="py-1 pr-3 whitespace-nowrap">{label}</td>
                        <td className="py-1 text-right">
                          <button
                            onClick={() =>
                              run(t("Delete failed"), () =>
                                admin.deleteInvite(iv.id),
                              )
                            }
                            className="text-red-300 hover:bg-red-500/15 px-2 py-0.5 rounded-md text-xs transition-colors"
                          >
                            {t("Delete")}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && (
        <AddDeviceModal
          onClose={() => setShowAdd(false)}
          onAdded={loadInvites}
        />
      )}
    </div>
  );
}
