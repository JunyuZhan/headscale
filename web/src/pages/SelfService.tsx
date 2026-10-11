import { useEffect, useState, type FormEvent } from "react";
import { useOutletContext } from "react-router-dom";
import { api, self, type Me, type User } from "../api/client";
import { useI18n } from "../i18n";
import { buildMobileConfig, buildAndroidConfig } from "../lib/mobileconfig";

interface NodeRow {
  id?: string;
  name?: string;
  givenName?: string;
  online?: boolean;
  connected?: boolean;
  lastSeen?: string;
  addresses?: string[];
  ipAddresses?: string[];
}

interface KeyResult {
  key: string;
  server_url: string;
  headscale_user: string;
  commands: Record<string, string>;
  expiration_hours: number;
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

export default function SelfService() {
  const me = useOutletContext<Me>();
  const { t } = useI18n();
  const isAdmin = me.role === "admin";

  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [reusable, setReusable] = useState(false);
  const [ephemeral, setEphemeral] = useState(false);
  const [hours, setHours] = useState(24);

  const [users, setUsers] = useState<User[]>([]);
  const [targetUser, setTargetUser] = useState("");

  const [result, setResult] = useState<KeyResult | null>(null);

  const load = async () => {
    setError("");
    try {
      if (isAdmin) {
        const u = await api.listUsers();
        setUsers(u.users ?? []);
        setTargetUser((prev) => prev || u.users?.[0]?.name || "");
      } else {
        const info = await self.info();
        setNodes((info.nodes as NodeRow[]) ?? []);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const generate = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setBusy(true);
    try {
      const r = await self.createKey(
        reusable,
        ephemeral,
        hours,
        isAdmin ? targetUser : undefined,
      );
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = (text: string) => navigator.clipboard?.writeText(text);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">{t("My devices")}</h2>
        <p className="text-sm text-graphite">
          账号 <span className="text-ember">{me.username}</span>
          {me.headscale_user
            ? ` 映射到 Headscale 用户 ${me.headscale_user}`
            : ""}
        </p>
      </div>

      {error && <div className="text-[#a32d2d] text-sm">{error}</div>}

      {!isAdmin && (
        <div className="card p-4">
          <h3 className="text-sm font-medium text-ink mb-3">
            {t("Joined devices")}
          </h3>
          {nodes.length === 0 ? (
            <p className="text-sm text-steel">{t("No devices yet.")}</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-graphite">
                  <tr className="text-left">
                    <th className="py-1 pr-3">{t("Name")}</th>
                    <th className="py-1 pr-3">{t("Address")}</th>
                    <th className="py-1 pr-3">{t("Status")}</th>
                    <th className="py-1">{t("Last seen")}</th>
                  </tr>
                </thead>
                <tbody className="text-graphite">
                  {nodes.map((n, i) => (
                    <tr key={n.id ?? i} className="border-t border-mist">
                      <td className="py-1 pr-3">{n.givenName ?? n.name ?? "—"}</td>
                      <td className="py-1 pr-3 font-mono">
                        {((n.ipAddresses ?? n.addresses) ?? []).join(", ")}
                      </td>
                      <td className="py-1 pr-3">
                        {n.online ?? n.connected ? (
                          <span className="text-live">{t("online")}</span>
                        ) : (
                          <span className="text-steel">{t("offline")}</span>
                        )}
                      </td>
                      <td className="py-1">{n.lastSeen ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="card p-4 space-y-3 max-w-lg">
        <h3 className="text-sm font-medium text-ink">
          {t("Generate join key (self-service)")}
        </h3>

        {isAdmin &&
          (users.length === 0 ? (
            <p className="text-sm text-[#9a6700]">
              {t("Create a Headscale user first")}
            </p>
          ) : (
            <div>
              <label className="block text-xs text-graphite mb-1">
                {t("Target user")}
              </label>
              <select
                value={targetUser}
                onChange={(e) => setTargetUser(e.target.value)}
                className="focus-ring w-full bg-paper border border-mist rounded-xl p-2 text-ink"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          ))}

        <KeyForm
          reusable={reusable}
          setReusable={setReusable}
          ephemeral={ephemeral}
          setEphemeral={setEphemeral}
          hours={hours}
          setHours={setHours}
          busy={busy}
          onSubmit={generate}
        />
      </div>

      {result && (
        <div className="card p-4 space-y-4">
          <div>
            <h3 className="text-base font-medium text-ink mb-1">
              {t("Join command (key shown once)")}
            </h3>
            <p className="text-xs text-steel mb-3">
              {t("Token valid for")} {result.expiration_hours} {t("hours")} ·
              {t("Revoke anytime from")} <span className="text-ember">{t("Nodes")}</span>
            </p>
          </div>

          {/* macOS / Linux */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-ink">
                {t("Linux / macOS")}
              </span>
              <div className="space-x-2">
                <button
                  onClick={() => copy(result.commands.linux_macos ?? "")}
                  className="text-xs bg-fog hover:bg-mist text-ink border border-mist px-2 py-1 rounded"
                >
                  {t("Copy install script")}
                </button>
                <button
                  onClick={() =>
                    download("join.sh", result.commands.linux_macos ?? "")
                  }
                  className="text-xs bg-fog hover:bg-mist text-ink border border-mist px-2 py-1 rounded"
                >
                  {t("Download script")}
                </button>
              </div>
            </div>
            <pre className="bg-fog border border-mist rounded-xl p-3 text-xs text-live overflow-auto">
{result.commands.linux_macos}
            </pre>
          </div>

          {/* Windows */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-ink">
                {t("Windows")}
              </span>
              <div className="space-x-2">
                <button
                  onClick={() => copy(result.commands.windows ?? "")}
                  className="text-xs bg-fog hover:bg-mist text-ink border border-mist px-2 py-1 rounded"
                >
                  {t("Copy install script")}
                </button>
                <button
                  onClick={() =>
                    download("join.ps1", result.commands.windows ?? "")
                  }
                  className="text-xs bg-fog hover:bg-mist text-ink border border-mist px-2 py-1 rounded"
                >
                  {t("Download script")}
                </button>
              </div>
            </div>
            <pre className="bg-fog border border-mist rounded-xl p-3 text-xs text-live overflow-auto">
{result.commands.windows}
            </pre>
          </div>

          {/* Mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="rounded-xl border border-mist bg-fog p-4 space-y-2">
              <div className="text-sm font-medium text-ink">
                {t("Mobile access")} · iOS
              </div>
              <button
                onClick={() =>
                  download(
                    "tailscale.mobileconfig",
                    buildMobileConfig(result.server_url, result.key),
                  )
                }
                className="bg-ember hover:bg-ember-600 text-paper px-3 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                {t("Download profile (iOS)")}
              </button>
              <p className="text-xs text-graphite">{t("Install profile hint")}</p>
              <p className="text-xs text-steel">{t("Auth key embedded")}</p>
            </div>
            <div className="rounded-xl border border-mist bg-fog p-4 space-y-2">
              <div className="text-sm font-medium text-ink">
                {t("Mobile access")} · {t("Android access")}
              </div>
              <pre className="bg-fog border border-mist rounded-xl p-3 text-xs text-live overflow-auto">
{buildAndroidConfig(result.server_url, result.key)}
              </pre>
              <button
                onClick={() =>
                  copy(buildAndroidConfig(result.server_url, result.key))
                }
                className="text-xs bg-fog hover:bg-mist text-ink border border-mist px-2 py-1 rounded-xl"
              >
                {t("Copy config")}
              </button>
              <p className="text-xs text-steel">{t("Android note")}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KeyForm({
  reusable,
  setReusable,
  ephemeral,
  setEphemeral,
  hours,
  setHours,
  busy,
  onSubmit,
}: {
  reusable: boolean;
  setReusable: (v: boolean) => void;
  ephemeral: boolean;
  setEphemeral: (v: boolean) => void;
  hours: number;
  setHours: (v: number) => void;
  busy: boolean;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-xs text-graphite">
        生成后复制下方命令，在设备安装 Tailscale 客户端并运行即可自动加入网络；手机用户可直接下载移动端配置。
      </p>
      <div className="flex flex-wrap items-center gap-4 text-sm text-graphite">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={reusable}
            onChange={(e) => setReusable(e.target.checked)}
          />
          可复用
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={ephemeral}
            onChange={(e) => setEphemeral(e.target.checked)}
          />
          临时节点
        </label>
        <label className="flex items-center gap-2">
          有效期(小时)
          <input
            type="number"
            min={1}
            max={720}
            value={hours}
            onChange={(e) => setHours(Math.max(1, Number(e.target.value) || 24))}
            className="focus-ring w-20 bg-paper border border-mist rounded-xl p-1"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="bg-ember hover:bg-ember-600 text-paper py-2 px-4 rounded-md text-sm font-medium disabled:opacity-50"
      >
        {busy ? "生成中…" : "生成接入命令"}
      </button>
    </form>
  );
}
