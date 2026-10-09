import { useState, useEffect, type ReactNode } from "react";
import { api } from "../api/client";

const DEFAULT_POLICY = `{
  // Groups define sets of users or devices.
  "groups": {
    "group:admins": ["demo"]
  },

  // Hosts let you alias IPs or CIDRs to a name.
  "hosts": {
    "internal-net": "10.0.0.0/24"
  },

  // Tag owners control which users may assign a tag.
  "tagOwners": {
    "tag:server": ["group:admins"]
  },

  // ACLs grant access between sources and destinations.
  "acls": [
    {
      "action": "accept",
      "src": ["*"],
      "dst": ["*:*"]
    }
  ]
}
`;

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
        setError(`Load failed: ${m}`);
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
      setMsg("Policy saved.");
    } catch (e) {
      setError(`Save failed: ${(e as Error).message}`);
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
      setMsg("Policy is valid.");
    } catch (e) {
      setError(`Check failed: ${(e as Error).message}`);
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
    setMsg("Rule appended. Review and Save.");
  };

  const parsed = parseHuJSON(text);
  const groups = (parsed?.groups as Record<string, string[]>) ?? {};
  const hosts = (parsed?.hosts as Record<string, string>) ?? {};
  const tagOwners = (parsed?.tagOwners as Record<string, string[]>) ?? {};
  const acls = (parsed?.acls as Array<{ action?: string; src?: string[]; dst?: string[] }>) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-white">ACL Policy</h1>
        <div className="space-x-2">
          <button
            onClick={load}
            disabled={busy}
            className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
          >
            Load
          </button>
          <button
            onClick={check}
            disabled={busy}
            className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
          >
            Validate
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
      {error && <div className="text-red-400 mb-3 text-sm">{error}</div>}
      {msg && <div className="text-emerald-400 mb-3 text-sm">{msg}</div>}
      {exists === false && (
        <div className="text-amber-400 mb-3 text-sm">
          No policy is stored yet. Saving will create one.
        </div>
      )}

      {/* Visualization */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <VizCard title="Groups">
          {Object.keys(groups).length === 0 ? (
            <Empty />
          ) : (
            Object.entries(groups).map(([g, m]) => (
              <div key={g} className="text-sm">
                <span className="text-brand-500">{g}</span>
                <span className="text-slate-400"> → {m.join(", ")}</span>
              </div>
            ))
          )}
        </VizCard>
        <VizCard title="Hosts">
          {Object.keys(hosts).length === 0 ? (
            <Empty />
          ) : (
            Object.entries(hosts).map(([h, c]) => (
              <div key={h} className="text-sm">
                <span className="text-brand-500">{h}</span>
                <span className="text-slate-400"> → {c}</span>
              </div>
            ))
          )}
        </VizCard>
        <VizCard title="Tag owners">
          {Object.keys(tagOwners).length === 0 ? (
            <Empty />
          ) : (
            Object.entries(tagOwners).map(([t, o]) => (
              <div key={t} className="text-sm">
                <span className="text-brand-500">{t}</span>
                <span className="text-slate-400"> → {o.join(", ")}</span>
              </div>
            ))
          )}
        </VizCard>
      </div>

      <VizCard title={`ACL rules (${acls.length})`}>
        {acls.length === 0 ? (
          <Empty />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-slate-400">
              <tr className="text-left">
                <th className="py-1 pr-3">Action</th>
                <th className="py-1 pr-3">Source</th>
                <th className="py-1">Destination</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {acls.map((r, i) => (
                <tr key={i} className="border-t border-slate-800 align-top">
                  <td className="py-1 pr-3">
                    <span
                      className={
                        r.action === "deny"
                          ? "text-red-400"
                          : "text-emerald-400"
                      }
                    >
                      {r.action ?? "accept"}
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

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mt-4 space-y-3">
        <h3 className="text-sm font-medium text-slate-200">Quick add rule</h3>
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-200"
          >
            <option value="accept">accept</option>
            <option value="deny">deny</option>
          </select>
          <input
            placeholder="src: group:admins,*"
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-200 flex-1 min-w-[12rem]"
          />
          <span className="text-slate-400">→</span>
          <input
            placeholder="dst: tag:server:80"
            value={dst}
            onChange={(e) => setDst(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-200 flex-1 min-w-[12rem]"
          />
          <button
            onClick={addRule}
            className="bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded text-sm"
          >
            Add
          </button>
        </div>
        <p className="text-xs text-slate-500">
          添加规则会以规范 JSON 覆盖当前文本（注释会丢失）。添加后请审阅并点 Save。
        </p>
      </div>

      <p className="text-slate-400 text-xs mb-2 mt-4">
        Editing requires DB mode (policy.mode: database); in file mode the policy
        lives on disk. HuJSON allows comments and trailing commas.
      </p>
      <textarea
        className="w-full h-[40vh] bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm font-mono text-slate-200"
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </div>
  );
}

function VizCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <h3 className="text-sm font-medium text-slate-200 mb-2">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Empty() {
  return <div className="text-sm text-slate-500">— none —</div>;
}
