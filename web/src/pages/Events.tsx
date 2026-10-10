import { useCallback, useEffect, useState } from "react";
import { admin, type Event } from "../api/client";
import { useI18n } from "../i18n";

// Maps an event type to a Tailwind badge color.
function badgeClass(type: string): string {
  if (type.startsWith("login_fail") || type === "login_blocked")
    return "bg-red-500/15 text-red-300";
  if (type === "node_offline" || type === "key_expiring")
    return "bg-amber-500/15 text-amber-300";
  if (type === "delete_user" || type === "node_delete" || type === "reset_password")
    return "bg-orange-500/15 text-orange-300";
  if (type === "login" || type === "node_join" || type === "create_key" || type === "create_user")
    return "bg-emerald-500/15 text-emerald-300";
  return "bg-slate-500/15 text-slate-300";
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
        <h1 className="text-xl font-semibold text-white">{t("Activity log")}</h1>
        <button
          onClick={load}
          className="text-xs text-slate-400 border border-slate-700 rounded-lg px-2.5 py-1.5 hover:bg-slate-800 hover:text-slate-200 transition-colors"
        >
          {t("Refresh")}
        </button>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 text-slate-400">{t("Loading…")}</div>
        ) : events.length === 0 ? (
          <div className="p-6 text-slate-400">{t("No activity yet.")}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
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
                <tr key={e.id} className="border-b border-slate-800/60 text-slate-300">
                  <td className="p-3 whitespace-nowrap text-slate-400">
                    {new Date(e.time).toLocaleString()}
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
                  <td className="p-3 text-slate-400">{e.detail || "—"}</td>
                  <td className="p-3 whitespace-nowrap text-slate-500">{e.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
