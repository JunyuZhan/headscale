import { useEffect, useState, type FormEvent } from "react";
import { api, self, type User } from "../api/client";
import { useI18n } from "../i18n";

interface KeyResult {
  key: string;
  server_url: string;
  headscale_user: string;
  commands: Record<string, string>;
  expiration_hours: number;
}

// Invite device: admin generates a Pre-Auth Key for a chosen Headscale user and
// gets a single-line command (install + join) to hand to a colleague. The
// colleague runs it, the device auto-joins, and the admin can revoke it anytime
// from the Nodes page.
export default function Invite() {
  const { t } = useI18n();

  const [users, setUsers] = useState<User[]>([]);
  const [targetUser, setTargetUser] = useState("");
  const [reusable, setReusable] = useState(false);
  const [ephemeral, setEphemeral] = useState(false);
  const [hours, setHours] = useState(24);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<KeyResult | null>(null);

  useEffect(() => {
    setError("");
    api
      .listUsers()
      .then((r) => {
        setUsers(r.users ?? []);
        setTargetUser((prev) => prev || r.users?.[0]?.name || "");
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  const generate = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    if (!targetUser) {
      setError(t("Target user is required"));
      return;
    }
    setBusy(true);
    try {
      const r = await self.createKey(reusable, ephemeral, hours, targetUser);
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = (text: string) => navigator.clipboard?.writeText(text);

  const download = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">
          {t("Invite device")}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {t("Invite a colleague to join")}
        </p>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3 max-w-lg">
        <label className="block text-xs text-slate-400 mb-1">
          {t("Target user")}
        </label>
        <select
          value={targetUser}
          onChange={(e) => setTargetUser(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200"
        >
          {users.map((u) => (
            <option key={u.id} value={u.name}>
              {u.name}
            </option>
          ))}
        </select>

        <form onSubmit={generate} className="space-y-3 pt-2">
          <p className="text-xs text-slate-400">
            {t("Generate an invite command with a built-in token.")}
          </p>
          <div className="flex items-center gap-4 text-sm text-slate-300">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={reusable}
                onChange={(e) => setReusable(e.target.checked)}
              />
              {t("Reusable")}
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={ephemeral}
                onChange={(e) => setEphemeral(e.target.checked)}
              />
              {t("Ephemeral")}
            </label>
            <label className="flex items-center gap-2">
              {t("Expiration")}({t("hours")})
              <input
                type="number"
                min={1}
                max={720}
                value={hours}
                onChange={(e) =>
                  setHours(Math.max(1, Number(e.target.value) || 24))
                }
                className="w-20 bg-slate-800 border border-slate-700 rounded p-1"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="bg-brand-600 hover:bg-brand-500 text-white py-2 px-4 rounded-md text-sm font-medium disabled:opacity-50"
          >
            {busy ? t("Loading…") : t("Generate invite command")}
          </button>
        </form>
      </div>

      {result && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-slate-200">
              {t("Key (shown once)")}
            </h3>
            <code className="block mt-1 break-all text-emerald-300 text-xs">
              {result.key}
            </code>
            <p className="text-xs text-slate-500 mt-1">
              {t("Copy it now — it will not be shown again.")}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-200">
                {t("Linux / macOS")}
              </span>
              <div className="space-x-2">
                <button
                  onClick={() => copy(result.commands.linux_macos ?? "")}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded"
                >
                  {t("Copy install script")}
                </button>
                <button
                  onClick={() =>
                    download("join.sh", result.commands.linux_macos ?? "")
                  }
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded"
                >
                  {t("Download script")}
                </button>
              </div>
            </div>
            <pre className="bg-slate-950 border border-slate-800 rounded p-3 text-xs text-emerald-300 overflow-auto">
{result.commands.linux_macos}
            </pre>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-200">
                {t("Windows")}
              </span>
              <div className="space-x-2">
                <button
                  onClick={() => copy(result.commands.windows ?? "")}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded"
                >
                  {t("Copy install script")}
                </button>
                <button
                  onClick={() =>
                    download("join.ps1", result.commands.windows ?? "")
                  }
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded"
                >
                  {t("Download script")}
                </button>
              </div>
            </div>
            <pre className="bg-slate-950 border border-slate-800 rounded p-3 text-xs text-emerald-300 overflow-auto">
{result.commands.windows}
            </pre>
          </div>

          <p className="text-xs text-slate-400">{result.commands.note}</p>
          <p className="text-xs text-slate-500">
            {t("Token valid for")} {result.expiration_hours} {t("hours")} ·
            {t("Revoke anytime from")} <span className="text-brand-500">{t("Nodes")}</span>
          </p>
        </div>
      )}
    </div>
  );
}
