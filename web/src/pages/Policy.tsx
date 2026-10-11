import { useState, useEffect, type ReactNode } from "react";
import { api } from "../api/client";
import { useI18n } from "../i18n";

const DEFAULT_POLICY = `{
  // 默认拒绝一切流量（Tailscale ACL 默认即 deny-all）。
  // 仅放行：任意节点 → tag:server（内网服务器节点）。成员之间互不可达。
  // 内网服务器节点加入后，由管理员打上 tag:server 才会生效。
  "tagOwners": {
    "tag:server": ["owner@hsnet.sclink.dev"]
  },
  "acls": [
    {
      "action": "accept",
      "src": ["*"],
      "dst": ["tag:server:*"]
    }
  ]
}
`;

// Two switchable presets. The network is a single tailnet with ONE global
// policy, but tags let us scope it per device, so "global" does not mean
// "can't be granular". These presets are applied via the same save path.
const PRESET_ISOLATED = `{
  // 成员隔离：仅放行 成员 → tag:server（内网服务器节点）；成员之间互不可达。
  // 内网服务器节点加入后，由管理员在「节点」页打上 tag:server 才会生效。
  "tagOwners": { "tag:server": ["owner@hsnet.sclink.dev"] },
  "acls": [ { "action": "accept", "src": ["*"], "dst": ["tag:server:*"] } ]
}`;

const PRESET_MESH = `{
  // 成员互访：成员之间可互通，且都能访问 tag:server（内网服务器节点）。
  "tagOwners": { "tag:server": ["owner@hsnet.sclink.dev"], "tag:client": ["owner@hsnet.sclink.dev"] },
  "acls": [ { "action": "accept", "src": ["*"], "dst": ["*:*"] } ]
}`;

// parseHuJSON removes // and /* */ comments (while respecting strings) and
// trailing commas, then JSON-parses the result.
function parseHuJSON(text: string): Record<string, unknown> | null {
  let out = "";
  let i = 0;
  let inStr: string | null = null;
  while (i < text.length) {
    const c = text[i];
    if (inStr) {
      out += c;
      if (c === "\\") {
        out += text[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (c === inStr) inStr = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = c;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  // strip trailing commas
  out = out.replace(/,(\s*[}\]])/g, "$1");
  try {
    return JSON.parse(out);
  } catch {
    return null;
  }
}

export default function Policy() {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [exists, setExists] = useState<boolean | null>(null);

  // quick-add rule form
  const [src, setSrc] = useState("*");
  const [dst, setDst] = useState("*:*");
  const [action, setAction] = useState("accept");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setError("");
    setBusy(true);
    try {
      const p = await api.getPolicy();
      setText(p.policy ?? "");
      setExists((p.policy ?? "").trim().length > 0);
    } catch (e) {
      const m = (e as Error).message;
      if (/not found|404|500/.test(m)) {
        setText(DEFAULT_POLICY);
        setExists(false);
      } else {
        setError(`${t("Load")}失败: ${m}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setError("");
    setMsg("");
    setBusy(true);
    try {
      await api.setPolicy(text);
      setMsg(`${t("Save")}成功。`);
    } catch (e) {
      setError(`${t("Save")}失败: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    setError("");
    setMsg("");
    setBusy(true);
    try {
      await api.checkPolicy(text);
      setMsg(`${t("Validate")}通过，策略有效。`);
    } catch (e) {
      setError(`${t("Validate")}失败: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const applyPreset = async (preset: string, label: string) => {
    setError("");
    setMsg("");
    setBusy(true);
    try {
      await api.setPolicy(preset);
      setText(preset);
      setExists(true);
      setMsg(`${label} 已应用并保存。`);
    } catch (e) {
      setError(`${t("Save")}失败: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const addRule = () => {
    const obj = parseHuJSON(text) ?? {};
    const acls = Array.isArray(obj.acls) ? (obj.acls as unknown[]) : [];
    acls.push({
      action,
      src: src.split(",").map((s) => s.trim()).filter(Boolean),
      dst: dst.split(",").map((s) => s.trim()).filter(Boolean),
    });
    obj.acls = acls;
    setText(JSON.stringify(obj, null, 2));
    setMsg("已追加规则，请审阅后保存。");
  };

  const parsed = parseHuJSON(text);
  const groups = (parsed?.groups as Record<string, string[]>) ?? {};
  const hosts = (parsed?.hosts as Record<string, string>) ?? {};
  const tagOwners = (parsed?.tagOwners as Record<string, string[]>) ?? {};
  const acls = (parsed?.acls as Array<{ action?: string; src?: string[]; dst?: string[] }>) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[28px] leading-[1.3] tracking-heading font-semibold text-ink">{t("ACL Policy")}</h1>
        <div className="space-x-2">
          <button
            onClick={load}
            disabled={busy}
            className="bg-fog text-ink hover:bg-mist px-3 py-1.5 rounded text-sm disabled:opacity-50"
          >
            {t("Load")}
          </button>
          <button
            onClick={check}
            disabled={busy}
            className="bg-fog text-ink hover:bg-mist px-3 py-1.5 rounded text-sm disabled:opacity-50"
          >
            {t("Validate")}
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="bg-ember hover:bg-ember-600 text-[color:var(--on-ember)] px-3 py-1.5 rounded text-sm disabled:opacity-50"
          >
            {t("Save")}
          </button>
          <button
            onClick={() => applyPreset(PRESET_ISOLATED, t("Isolated mode"))}
            disabled={busy}
            className="bg-fog text-ink hover:bg-mist px-3 py-1.5 rounded text-sm disabled:opacity-50"
          >
            {t("Isolated mode")}
          </button>
          <button
            onClick={() => applyPreset(PRESET_MESH, t("Mesh mode"))}
            disabled={busy}
            className="bg-fog text-ink hover:bg-mist px-3 py-1.5 rounded text-sm disabled:opacity-50"
          >
            {t("Mesh mode")}
          </button>
        </div>
      </div>
      {error && <div className="text-[color:var(--danger)] mb-3 text-sm">{error}</div>}
      {msg && <div className="text-live mb-3 text-sm">{msg}</div>}
      {exists === false && (
        <div className="text-[color:var(--warning)] mb-3 text-sm">
          {t("No policy is stored yet. Saving will create one.")}
        </div>
      )}

      {/* Visualization */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <VizCard title={t("Groups")}>
          {Object.keys(groups).length === 0 ? (
            <Empty />
          ) : (
            Object.entries(groups).map(([g, m]) => (
              <div key={g} className="text-sm">
                <span className="text-[color:var(--ember-text)]">{g}</span>
                <span className="text-graphite"> → {m.join(", ")}</span>
              </div>
            ))
          )}
        </VizCard>
        <VizCard title={t("Hosts")}>
          {Object.keys(hosts).length === 0 ? (
            <Empty />
          ) : (
            Object.entries(hosts).map(([h, c]) => (
              <div key={h} className="text-sm">
                <span className="text-[color:var(--ember-text)]">{h}</span>
                <span className="text-graphite"> → {c}</span>
              </div>
            ))
          )}
        </VizCard>
        <VizCard title={t("Tag owners")}>
          {Object.keys(tagOwners).length === 0 ? (
            <Empty />
          ) : (
            Object.entries(tagOwners).map(([tag, o]) => (
              <div key={tag} className="text-sm">
                <span className="text-[color:var(--ember-text)]">{tag}</span>
                <span className="text-graphite"> → {o.join(", ")}</span>
              </div>
            ))
          )}
        </VizCard>
      </div>

      <VizCard title={`${t("ACL rules")} (${acls.length})`}>
        {acls.length === 0 ? (
          <Empty />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-graphite">
              <tr className="text-left">
                <th className="py-1 pr-3">{t("Action")}</th>
                <th className="py-1 pr-3">{t("Source")}</th>
                <th className="py-1">{t("Destination")}</th>
              </tr>
            </thead>
            <tbody className="text-graphite">
              {acls.map((r, i) => (
                <tr key={i} className="border-t border-mist align-top">
                  <td className="py-1 pr-3">
                    <span
                      className={
                        r.action === "deny"
                          ? "text-[color:var(--danger)]"
                          : "text-live"
                      }
                    >
                      {t(r.action ?? "accept")}
                    </span>
                  </td>
                  <td className="py-1 pr-3">{(r.src ?? []).join(", ")}</td>
                  <td className="py-1">{(r.dst ?? []).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </VizCard>

      <div className="bg-paper border border-mist rounded-xl p-4 mt-4 space-y-3">
        <h3 className="text-sm font-medium text-ink">{t("Quick add rule")}</h3>
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="focus-ring bg-paper border border-mist rounded-xl p-1.5 text-ink"
          >
            <option value="accept">{t("accept")}</option>
            <option value="deny">{t("deny")}</option>
          </select>
          <input
            placeholder="src: group:admins,*"
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            className="focus-ring bg-paper border border-mist rounded-xl p-1.5 text-ink flex-1 min-w-[12rem]"
          />
          <span className="text-graphite">→</span>
          <input
            placeholder="dst: tag:server:80"
            value={dst}
            onChange={(e) => setDst(e.target.value)}
            className="focus-ring bg-paper border border-mist rounded-xl p-1.5 text-ink flex-1 min-w-[12rem]"
          />
          <button
            onClick={addRule}
            className="bg-ember hover:bg-ember-600 text-[color:var(--on-ember)] px-3 py-1.5 rounded text-sm"
          >
            {t("Add")}
          </button>
        </div>
        <p className="text-xs text-steel">
          添加规则会以规范 JSON 覆盖当前文本（注释会丢失）。添加后请审阅并点击「{t("Save")}」。
        </p>
      </div>

      <p className="text-graphite text-xs mb-2 mt-4">
        编辑需要数据库模式（policy.mode: database）；在文件模式下策略存于磁盘。HuJSON 支持注释与尾随逗号。
      </p>
      <textarea
        className="w-full h-[40vh] bg-paper border border-mist rounded-xl p-3 text-sm font-mono text-ink"
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </div>
  );
}

function VizCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-paper border border-mist rounded-xl p-4">
      <h3 className="text-sm font-medium text-ink mb-2">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Empty() {
  return <div className="text-sm text-steel">{`— 无 —`}</div>;
}
