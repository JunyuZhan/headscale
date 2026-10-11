import { useEffect, useState, type FormEvent } from "react";
import { api, self, type User } from "../api/client";
import { useI18n } from "../i18n";
import { buildMobileConfig } from "../lib/mobileconfig";

interface KeyResult {
  key: string;
  server_url: string;
  headscale_user: string;
  commands: Record<string, string>;
  expiration_hours: number;
}

function copy(text: string) {
  navigator.clipboard?.writeText(text);
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Modal that turns "add a device to the network" into a single action on the
// Nodes page: pick the target user, describe the device, generate a one-line
// invite command (install + join), and hand it to the colleague.
export default function AddDeviceModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
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

  useEffect(() => {
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
      onAdded();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-abyss/40 backdrop-blur-sm flex items-start justify-center z-50 overflow-y-auto p-4"
      onClick={onClose}
    >
      <div
        className="bg-paper border border-mist rounded-xl w-full max-w-2xl my-6 shadow-[var(--shadow-modal)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-mist">
          <div>
            <h3 className="text-lg font-semibold text-ink">{t("Add device")}</h3>
            <p className="text-xs text-graphite mt-0.5">
              {t("Generate an invite command with a built-in token.")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-graphite hover:text-ink text-sm px-2 py-1 rounded hover:bg-paper"
          >
            {t("Close")}
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && <div className="text-[color:var(--danger)] text-sm">{error}</div>}

          <form onSubmit={generate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-graphite mb-1">
                  {t("Target user")}
                </label>
                <select
                  value={targetUser}
                  onChange={(e) => setTargetUser(e.target.value)}
                  className="focus-ring w-full bg-paper border border-mist rounded-xl p-2 text-sm text-ink"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-graphite mb-1">
                  {t("Device description")}
                </label>
                <input
                  value={deviceDesc}
                  onChange={(e) => setDeviceDesc(e.target.value)}
                  placeholder="zhangsan-laptop"
                  className="focus-ring w-full bg-paper border border-mist rounded-xl p-2 text-sm text-ink"
                />
                <p className="text-[11px] text-steel mt-1">
                  {t("Used as node hostname; ASCII only, e.g. zhangsan-laptop")}
                </p>
              </div>
              <div>
                <label className="block text-xs text-graphite mb-1">
                  {t("Applicant")}
                </label>
                <input
                  value={applicant}
                  onChange={(e) => setApplicant(e.target.value)}
                  className="focus-ring w-full bg-paper border border-mist rounded-xl p-2 text-sm text-ink"
                />
              </div>
              <div>
                <label className="block text-xs text-graphite mb-1">
                  {t("Organization")}
                </label>
                <input
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                  className="focus-ring w-full bg-paper border border-mist rounded-xl p-2 text-sm text-ink"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-graphite pt-1">
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
                  className="focus-ring w-20 bg-paper border border-mist rounded-xl p-1"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="ml-auto bg-ember hover:bg-ember-600 text-paper py-2 px-4 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {busy ? t("Loading…") : t("Generate invite command")}
              </button>
            </div>
          </form>

          {result && (
            <div className="space-y-4 border-t border-mist pt-4">
              <div>
                <h4 className="text-sm font-medium text-ink">
                  {t("Key (shown once)")}
                </h4>
                <code className="block mt-1 break-all text-live text-xs">
                  {result.key}
                </code>
                <p className="text-xs text-steel mt-1">
                  {t("Copy it now — it will not be shown again.")}
                </p>
              </div>

              {(["linux_macos", "windows"] as const).map((plat) => (
                <div key={plat}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-ink">
                      {plat === "linux_macos" ? t("Linux / macOS") : t("Windows")}
                    </span>
                    <div className="space-x-2">
                      <button
                        onClick={() => copy(result.commands[plat] ?? "")}
                        className="text-xs bg-fog hover:bg-mist text-ink border border-mist px-2 py-1 rounded"
                      >
                        {t("Copy install script")}
                      </button>
                      <button
                        onClick={() =>
                          download(
                            plat === "windows" ? "join.ps1" : "join.sh",
                            result.commands[plat] ?? "",
                          )
                        }
                        className="text-xs bg-fog hover:bg-mist text-ink border border-mist px-2 py-1 rounded"
                      >
                        {t("Download script")}
                      </button>
                    </div>
                  </div>
                  <pre className="bg-fog border border-mist rounded p-3 text-xs text-live overflow-auto">
                    {result.commands[plat]}
                  </pre>
                </div>
              ))}

              <p className="text-xs text-graphite">{result.commands.note}</p>

              <div>
                <h4 className="text-sm font-medium text-ink mb-2">
                  {t("Mobile access")}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-mist bg-fog p-3 space-y-2">
                    <div className="text-xs font-medium text-ink">
                      iOS（iPhone / iPad）
                    </div>
                    <button
                      onClick={() =>
                        download(
                          "tailscale.mobileconfig",
                          buildMobileConfig(result.server_url, result.key),
                        )
                      }
                      className="bg-ember hover:bg-ember-600 text-paper px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                    >
                      {t("Download profile (iOS)")}
                    </button>
                    <p className="text-[11px] text-steel">{t("Auth key embedded")}</p>
                  </div>
                  <div className="rounded-xl border border-mist bg-fog p-3 space-y-2">
                    <div className="text-xs font-medium text-ink">
                      {t("Android access")}
                    </div>
                    <pre className="bg-fog border border-mist rounded p-2 text-[11px] text-live overflow-auto">
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
                      className="text-xs bg-fog hover:bg-mist text-ink border border-mist px-2 py-1 rounded-xl"
                    >
                      {t("Copy config")}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="bg-fog hover:bg-mist text-ink border border-mist px-4 py-2 rounded-xl text-sm"
                >
                  {t("Close")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
