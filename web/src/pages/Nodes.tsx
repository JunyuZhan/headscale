import { useCallback, useEffect, useState } from "react";
import { api, type Node } from "../api/client";
import { useI18n } from "../i18n";

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
        <button
          onClick={load}
          disabled={busy}
          className="bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50 transition-colors"
        >
          {t("Refresh")}
        </button>
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
                  {(n.addresses ?? []).join(", ") || "—"}
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
            {nodes.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-500">
                  {t("No nodes")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
