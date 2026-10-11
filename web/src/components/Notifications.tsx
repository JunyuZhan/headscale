import { useCallback, useEffect, useRef, useState } from "react";
import { admin, self, type Event } from "../api/client";
import { useI18n } from "../i18n";
import { useEventStream } from "../lib/useEventStream";

// Reusable colour mapping for event-type chips (kept in sync with Events.tsx).
// These are semantic encodings (severity), not brand accents.
function badgeClass(type: string): string {
  if (type.startsWith("login_fail") || type === "login_blocked")
    return "bg-[color:var(--danger-bg)] text-[color:var(--danger)]";
  if (type === "node_offline" || type === "key_expiring")
    return "bg-[color:var(--warning-bg)] text-[color:var(--warning)]";
  if (type === "delete_user" || type === "node_delete" || type === "reset_password")
    return "bg-[color:var(--info-bg)] text-[color:var(--info)]";
  if (type === "login" || type === "node_join" || type === "create_key" || type === "create_user")
    return "bg-[color:var(--success-bg)] text-[color:var(--success)]";
  return "bg-fog text-graphite";
}

// Human-friendly Chinese/English label per event type.
const TYPE_LABEL: Record<string, string> = {
  login: "登录",
  login_fail: "登录失败",
  login_blocked: "登录被锁定",
  logout: "登出",
  create_user: "创建用户",
  delete_user: "删除用户",
  create_webuser: "创建账号",
  delete_webuser: "删除账号",
  change_password: "修改密码",
  reset_password: "重置密码",
  create_key: "生成密钥",
  apply_policy: "更新策略",
  node_join: "节点入网",
  node_offline: "节点掉线",
  node_tag: "节点打标签",
  node_rename: "节点改名",
  node_expire: "节点过期",
  node_delete: "删除节点",
  key_expiring: "密钥将过期",
  proxy: "代理操作",
};

function label(type: string): string {
  return TYPE_LABEL[type] ?? type;
}

const FLOATING_SHADOW = "shadow-[var(--shadow-modal)]";

export default function Notifications({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useI18n();
  const [events, setEvents] = useState<Event[]>([]);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<Event[]>([]);
  const seenIds = useRef<Set<number>>(new Set());
  const lastSeenKey = `hs_notif_lastseen_${isAdmin ? "admin" : "user"}`;

  const markRead = useCallback(
    (list: Event[]) => {
      const maxId = list.reduce((m, e) => Math.max(m, e.id), 0);
      try {
        localStorage.setItem(lastSeenKey, String(maxId));
      } catch {
        /* ignore */
      }
    },
    [lastSeenKey],
  );

  // Initial load.
  const load = useCallback(() => {
    const req = isAdmin ? admin.events() : self.events();
    req
      .then((r) => {
        setEvents(r);
        r.forEach((e) => seenIds.current.add(e.id));
      })
      .catch(() => {
        /* ignore; bell simply stays empty */
      });
  }, [isAdmin]);

  useEffect(() => load(), [load]);

  const lastSeen = (() => {
    try {
      return Number(localStorage.getItem(lastSeenKey) ?? "0");
    } catch {
      return 0;
    }
  })();
  const unread = events.filter((e) => e.id > lastSeen).length;

  // Live push: prepend new events, show a toast, bump the badge.
  useEventStream(
    useCallback(
      (ev: Event) => {
        if (seenIds.current.has(ev.id)) return;
        seenIds.current.add(ev.id);
        setEvents((prev) => [ev, ...prev].slice(0, 100));
        setToasts((prev) => [ev, ...prev].slice(0, 4));
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((x) => x.id !== ev.id));
        }, 6000);
      },
      [],
    ),
  );

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && events.length > 0) markRead(events);
  };

  return (
    <div className="relative">
      <button
        onClick={toggle}
        className="relative flex items-center justify-center w-9 h-9 text-graphite border border-mist rounded-xl hover:bg-fog hover:text-ink transition-colors"
        title={t("Notifications")}
        aria-label={t("Notifications")}
      >
        <svg
          viewBox="0 0 24 24"
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 01-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[1.05rem] h-[1.05rem] px-1 rounded-full bg-ember text-paper text-[10px] font-semibold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* click-away layer */}
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            className={`absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-paper border border-mist rounded-xl z-30 ${FLOATING_SHADOW}`}
          >
            <div className="px-3 py-2 border-b border-mist flex items-center justify-between">
              <span className="text-sm font-medium text-ink">
                {t("Notifications")}
              </span>
              <button
                onClick={() => {
                  markRead(events);
                  setOpen(false);
                }}
                className="text-[11px] text-graphite hover:text-ink"
              >
                {t("Mark all read")}
              </button>
            </div>
            {events.length === 0 ? (
              <div className="p-4 text-sm text-steel">{t("No notifications")}</div>
            ) : (
              <ul>
                {events.slice(0, 30).map((e) => (
                  <li
                    key={e.id}
                    className="px-3 py-2 border-b border-[color:var(--mist-50)] last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-medium ${badgeClass(
                          e.type,
                        )}`}
                      >
                        {label(e.type)}
                      </span>
                      <span className="text-[11px] text-steel ml-auto whitespace-nowrap">
                        {new Date(e.time).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-xs text-graphite mt-1 truncate">
                      {e.target ? `${e.target}` : ""}
                      {e.detail ? ` · ${e.detail}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 w-72">
        {toasts.map((e) => (
          <div
            key={e.id}
            className={`bg-paper border border-mist rounded-xl px-3 py-2 ${FLOATING_SHADOW}`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-medium ${badgeClass(
                  e.type,
                )}`}
              >
                {label(e.type)}
              </span>
            </div>
            <div className="text-xs text-graphite mt-1">
              {e.target ? `${e.target}` : ""}
              {e.detail ? ` · ${e.detail}` : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
