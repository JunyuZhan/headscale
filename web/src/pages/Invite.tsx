import { useEffect, useState, type FormEvent } from "react";
import { api, admin, self, type User, type Invite } from "../api/client";
import { useI18n } from "../i18n";
import { buildMobileConfig } from "../lib/mobileconfig";

interface KeyResult {
  key: string;
  server_url: string;
  headscale_user: string;
  commands: Record<string, string>;
  expiration_hours: number;
}

const STATUS_LABEL: Record<string, string> = {
  unused: "未使用",
  used: "已使用",
  expired: "已过期",
  revoked: "已吊销",
};

// Invite device: admin generates a Pre-Auth Key for a chosen Headscale user and
// gets a single-line command (install + join) to hand to a colleague. The
// colleague runs it, the device auto-joins, and the admin can revoke it anytime
// from the Nodes page. Every issuance is recorded in a traceable ledger.
export default function Invite() {
  const { t } = useI18n();

  const [users, setUsers] = useState<User[]>([]);
  const [targetUser, setTargetUser] = useState("");
  const [reusable, setReusable] = useState(false);
  const [ephemeral, setEphemeral] = useState(false);
  const [hours, setHours] = useState(24);
  const [applicant, setApplicant] = useState("");
  const [deviceDesc, setDeviceDesc] = useState("");
  const [org, setOrg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<KeyResult | null>(null);

  const [invites, setInvites] = useState<Invite[]>([]);
  const loadInvites = () => {
    admin
      .listInvites()
      .then(setInvites)
      .catch(() => {
        /* ledger is admin-only; ignore on error */
      });
  };

  useEffect(() => {
    setError("");
    api
      .listUsers()
      .then((r) => {
        setUsers(r.users ?? []);
        setTargetUser((prev) => prev || r.users?.[0]?.name || "");
      })
      .catch((e) => setError((e as Error).message));
    loadInvites();
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
      const r = await self.createKey(
        reusable,
        ephemeral,
        hours,
        targetUser,
        applicant,
        deviceDesc,
        org,
      );
      setResult(r);
      loadInvites();
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
          className="focus-ring w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
        >
          {users.map((u) => (
            <option key={u.id} value={u.name}>
              {u.name}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-1 gap-3 pt-1">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {t("Applicant")}
            </label>
            <input
              value={applicant}
              onChange={(e) => setApplicant(e.target.value)}
              placeholder={t("Applicant")}
              className="focus-ring w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {t("Device description")}
            </label>
            <input
              value={deviceDesc}
              onChange={(e) => setDeviceDesc(e.target.value)}
              placeholder={t("Device description")}
              className="focus-ring w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
            />
            <p className="text-xs text-slate-500 mt-1">
              {t("Used as node hostname; ASCII only, e.g. zhangsan-laptop")}
            </p>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {t("Organization")}
            </label>
            <input
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              placeholder={t("Organization")}
              className="focus-ring w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
            />
          </div>
        </div>

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
                className="focus-ring w-20 bg-slate-800 border border-slate-700 rounded-lg p-1"
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

      {result && (
        <div className="card p-4 space-y-4">
          <h3 className="text-base font-medium text-white">
            {t("Mobile access")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
              <div className="text-sm font-medium text-slate-200">
                iOS（iPhone / iPad）
              </div>
              <button
                onClick={() =>
                  download(
                    "tailscale.mobileconfig",
                    buildMobileConfig(result.server_url, result.key),
                  )
                }
                className="bg-brand-600 hover:bg-brand-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {t("Download profile (iOS)")}
              </button>
              <p className="text-xs text-slate-400">{t("Install profile hint")}</p>
              <p className="text-xs text-slate-500">{t("Auth key embedded")}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
              <div className="text-sm font-medium text-slate-200">
                {t("Android access")}
              </div>
              <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-emerald-300 overflow-auto">
{JSON.stringify({ ServerURL: result.server_url, AuthKey: result.key }, null, 2)}
              </pre>
              <button
                onClick={() =>
                  copy(
                    JSON.stringify(
                      { ServerURL: result.server_url, AuthKey: result.key },
                      null,
                      2,
                    ),
                  )
                }
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded-lg"
              >
                {t("Copy config")}
              </button>
              <p className="text-xs text-slate-500">{t("Android note")}</p>
            </div>
          </div>
        </div>
      )}

      <div className="card p-4">
        <h3 className="text-sm font-medium text-slate-200 mb-3">
          {t("Invitation ledger")}
        </h3>
        {invites.length === 0 ? (
          <div className="text-sm text-slate-500">{t("No invitations yet.")}</div>
        ) : (
          <div className="overflow-auto">
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
                  <th className="py-1">{t("Status")}</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {invites.map((inv) => (
                  <tr key={inv.id} className="border-t border-slate-800">
                    <td className="py-1 pr-3">{inv.applicant || "—"}</td>
                    <td className="py-1 pr-3">{inv.device_desc || "—"}</td>
                    <td className="py-1 pr-3">{inv.org || "—"}</td>
                    <td className="py-1 pr-3">{inv.hostname || "—"}</td>
                    <td className="py-1 pr-3">{inv.target_user}</td>
                    <td className="py-1 pr-3">{inv.created_by}</td>
                    <td className="py-1 pr-3">
                      {inv.expires_at.slice(0, 19).replace("T", " ")}
                    </td>
                    <td className="py-1">
                      {t(STATUS_LABEL[inv.status] ?? inv.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

