import { useEffect, useState, type FormEvent } from "react";
import { useOutletContext } from "react-router-dom";
import { self, type Me } from "../api/client";

interface NodeRow {
  id?: string;
  name?: string;
  connected?: boolean;
  lastSeen?: string;
  addresses?: string[];
}

export default function SelfService() {
  const me = useOutletContext<Me>();
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [reusable, setReusable] = useState(false);
  const [ephemeral, setEphemeral] = useState(false);
  const [hours, setHours] = useState(24);

  const [result, setResult] = useState<{
    key: string;
    server_url: string;
    headscale_user: string;
    commands: Record<string, string>;
    expiration_hours: number;
  } | null>(null);

  const load = async () => {
    setError("");
    try {
      const info = await self.info();
      setNodes((info.nodes as NodeRow[]) ?? []);
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
      const r = await self.createKey(reusable, ephemeral, hours);
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
        <h2 className="text-lg font-semibold text-white">My devices</h2>
        <p className="text-sm text-slate-400">
          账号 <span className="text-brand-500">{me.username}</span>
          {me.headscale_user
            ? ` 映射到 Headscale 用户 ${me.headscale_user}`
            : ""}
        </p>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-slate-200 mb-2">
          已加入的设备
        </h3>
        {nodes.length === 0 ? (
          <p className="text-sm text-slate-500">暂无设备。</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-slate-400">
              <tr className="text-left">
                <th className="py-1">名称</th>
                <th className="py-1">地址</th>
                <th className="py-1">状态</th>
                <th className="py-1">最近活跃</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {nodes.map((n, i) => (
                <tr key={n.id ?? i} className="border-t border-slate-800">
                  <td className="py-1">{n.name ?? "—"}</td>
                  <td className="py-1 font-mono">{(n.addresses ?? []).join(", ")}</td>
                  <td className="py-1">
                    {n.connected ? (
                      <span className="text-emerald-400">online</span>
                    ) : (
                      <span className="text-slate-500">offline</span>
                    )}
                  </td>
                  <td className="py-1">{n.lastSeen ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <form
        onSubmit={generate}
        className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3 max-w-lg"
      >
        <h3 className="text-sm font-medium text-slate-200">
          生成接入密钥（自助入网）
        </h3>
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
              className="w-20 bg-slate-800 border border-slate-700 rounded p-1"
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

      {result && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-200">
              接入命令（密钥仅显示一次）
            </h3>
            <button
              onClick={() => copy(result.commands.linux_macos ?? "")}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded"
            >
              复制命令
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
