// Localise an ISO timestamp for display only — always Asia/Shanghai (UTC+8).
// Backend storage and API values stay in UTC; this only controls what the
// user sees, so everyone reads the same Beijing clock regardless of their
// own browser/OS timezone.
export function formatDateTime(input: string): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return d.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });
}

// Compact "MM/DD HH:MM" for dense lists (notification dropdown / toasts).
// Same fixed Asia/Shanghai clock as formatDateTime — a raw toLocaleTimeString()
// here would follow the viewer's browser timezone and disagree with the rest
// of the UI, so this must not be replaced by a bare toLocale* call.
export function formatShort(input: string): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return d.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
