import { useEffect, useState, type FormEvent } from "react";
import { useOutletContext } from "react-router-dom";
import { api, self, type Me, type User } from "../api/client";
import { useI18n } from "../i18n";

interface NodeRow {
  id?: string;
  name?: string;
  connected?: boolean;
  lastSeen?: string;
  addresses?: string[];
}

interface KeyResult {
  key: string;
  server_url: string;
  headscale_user: string;
  commands: Record<string, string>;
  expiration_hours: number;
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
        <h2 className="text-lg font-semibold text-white">{t("My devices")}</h2>
        <p className="text-sm text-slate-400">
          账号 <span className="text-brand-500">{me.username}</span>
          {me.headscale_user
            ? ` 映射到 Headscale 用户 ${me.headscale_user}`
            : ""}
        </p>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      {!isAdmin && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-slate-200 mb-2">
            {t("Joined devices")}
          </h3>
          {nodes.length === 0 ? (
            <p className="text-sm text-slate-500">{t("No devices yet.")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-slate-400">
                <tr className="text-left">
                  <th className="py-1">{t("Name")}</th>
                  <th className="py-1">{t("Address")}</th>
                  <th className="py-1">{t("Status")}</th>
                  <th className="py-1">{t("Last seen")}</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {nodes.map((n, i) => (
                  <tr key={n.id ?? i} className="border-t border-slate-800">
                    <td className="py-1">{n.name ?? "—"}</td>
                    <td className="py-1 font-mono">
                      {(n.addresses ?? []).join(", ")}
                    </td>
                    <td className="py-1">
                      {n.connected ? (
                        <span className="text-emerald-400">{t("online")}</span>
                      ) : (
                        <span className="text-slate-500">{t("offline")}</span>
                      )}
                    </td>
                    <td className="py-1">{n.lastSeen ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3 max-w-lg">
        <h3 className="text-sm font-medium text-slate-200">
          {t("Generate join key (self-service)")}
        </h3>

        {isAdmin &&
          (users.length === 0 ? (
            <p className="text-sm text-amber-400">
              {t("Create a Headscale user first")}
            </p>
          ) : (
            <div>
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
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-200">
              {t("Join command (key shown once)")}
            </h3>
            <button
              onClick={() => copy(result.commands.linux_macos ?? "")}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded"
            >
              {t("Copy command")}
            </button>
          </div>
          <pre className="bg-slate-950 border border-slate-800 rounded p-3 text-xs text-emerald-300 overflow-auto">
{result.commands.linux_macos}
          </pre>
          <p className="text-xs text-slate-400">{result.commands.note}</p>
          <p className="text-xs text-slate-500">
            Windows 用户请将命令中的可执行文件替换为{" "}
            <code>tailscale.exe</code>。密钥有效期 {result.expiration_hours} 小时。
          </p>
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
      <p className="text-xs text-slate-400">
        生成后复制下方命令，在设备安装 Tailscale 客户端并运行即可自动加入网络。
      </p>
      <div className="flex items-center gap-4 text-sm text-slate-300">
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
            className="focus-ring w-20 bg-slate-800 border border-slate-700 rounded-lg p-1"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="bg-brand-600 hover:bg-brand-500 text-white py-2 px-4 rounded-md text-sm font-medium disabled:opacity-50"
      >
        {busy ? "Generating…" : "生成并下载配置"}
      </button>
    </form>
  );
}
