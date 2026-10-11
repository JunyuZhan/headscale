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
