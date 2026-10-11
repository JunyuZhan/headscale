import { useCallback, useEffect, useState } from "react";
import { admin, type Event } from "../api/client";
import { useI18n } from "../i18n";
import { formatDateTime } from "../lib/datetime";

// Maps an event type to a Tailwind badge color.
function badgeClass(type: string): string {
  if (type.startsWith("login_fail") || type === "login_blocked")
    return "bg-[color:var(--danger-bg)] text-[color:var(--danger)]";
  if (type === "node_offline" || type === "key_expiring")
    return "bg-[color:var(--warning-bg)] text-[color:var(--warning)]";
  if (type === "delete_user" || type === "node_delete" || type === "reset_password")
    // Was `bg-orange-500/15 text-orange-300` — a leftover from the old dark UI
    // that rendered light-orange-on-light-orange (1.45:1) in the light theme.
    return "bg-[color:var(--info-bg)] text-[color:var(--info)]";
  if (type === "login" || type === "node_join" || type === "create_key" || type === "create_user")
    return "bg-live-soft text-live";
  return "bg-fog text-graphite";
}

export default function Events() {
  const { t } = useI18n();
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    admin
      .events()
      .then((r) => setEvents(r))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">{t("Activity log")}</h1>
        <button
          onClick={load}
          className="text-xs text-graphite border border-mist rounded-xl px-2.5 py-1.5 hover:bg-paper hover:text-ink transition-colors"
        >
          {t("Refresh")}
        </button>
      </div>

      {error && <div className="text-[color:var(--danger)] text-sm">{error}</div>}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 text-graphite">{t("Loading…")}</div>
        ) : events.length === 0 ? (
          <div className="p-6 text-graphite">{t("No activity yet.")}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-graphite border-b border-mist">
                <th className="p-3 font-medium">{t("Time")}</th>
                <th className="p-3 font-medium">{t("Actor")}</th>
                <th className="p-3 font-medium">{t("Event")}</th>
                <th className="p-3 font-medium">{t("Target")}</th>
                <th className="p-3 font-medium">{t("Detail")}</th>
                <th className="p-3 font-medium">{t("IP")}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-[color:var(--mist-60)] text-graphite">
                  <td className="p-3 whitespace-nowrap text-graphite">
                    {formatDateTime(e.time)}
                  </td>
                  <td className="p-3 whitespace-nowrap">{e.actor}</td>
                  <td className="p-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeClass(
                        e.type,
                      )}`}
                    >
                      {e.type}
                    </span>
                  </td>
                  <td className="p-3 whitespace-nowrap">{e.target || "—"}</td>
                  <td className="p-3 text-graphite">{e.detail || "—"}</td>
                  <td className="p-3 whitespace-nowrap text-steel">{e.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
