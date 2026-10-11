import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, type PreAuthKey } from "../api/client";
import { useI18n } from "../i18n";

function toRFC3339(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export default function PreAuthKeys() {
  const { t } = useI18n();
  const [keys, setKeys] = useState<PreAuthKey[]>([]);
  const [newKey, setNewKey] = useState<PreAuthKey | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [user, setUser] = useState("");
  const [reusable, setReusable] = useState(false);
  const [ephemeral, setEphemeral] = useState(false);
  const [expiration, setExpiration] = useState("");
  const [aclTags, setAclTags] = useState("");

  const load = useCallback(() => {
    setBusy(true);
    api
      .listPreAuthKeys()
      .then((r) => setKeys(r.preAuthKeys))
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, []);

  useEffect(() => load(), [load]);

  const run = async (msg: string, fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
      load();
    } catch (e) {
      setError(`${msg}: ${(e as Error).message}`);
    }
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const u = user.trim();
    if (!u) {
      setError(t("User is required"));
      return;
    }
    setError("");
    try {
      const r = await api.createPreAuthKey(
        u,
        reusable,
        ephemeral,
        toRFC3339(expiration),
        aclTags
          .split(/\s+/)
          .map((tag) => tag.trim())
          .filter(Boolean),
      );
      setNewKey(r.preAuthKey);
      setUser("");
      setExpiration("");
      setAclTags("");
      setReusable(false);
      setEphemeral(false);
      load();
    } catch (e) {
      setError(`${t("Create failed")}: ${(e as Error).message}`);
    }
  };

  const Pill = ({
    on,
    yes,
    no,
  }: {
    on: boolean;
    yes: string;
    no: string;
  }) => (
    <span
      className={`text-xs px-2 py-0.5 rounded-full ${
        on
          ? "bg-live-soft text-live"
          : "bg-fog text-graphite"
      }`}
    >
      {on ? yes : no}
    </span>
  );

  return (
    <div>
      <h1 className="text-[28px] leading-[1.3] tracking-heading font-semibold text-ink">
        {t("Pre-auth keys")}
      </h1>
      <p className="text-sm text-graphite mt-1 mb-5">
        {t("Pre-auth keys let devices join without a web login.")}
      </p>

      {error && <div className="text-[color:var(--danger)] mb-3 text-sm">{error}</div>}

      {newKey?.key && (
        <div className="card border-[color:var(--live-40)] p-4 mb-5">
          <div className="text-live font-medium text-sm">
            {t("New key created")}
          </div>
          <code className="block mt-2 break-all text-live text-xs bg-fog rounded-xl p-3">
            {newKey.key}
          </code>
          <div className="text-live/70 text-xs mt-2">
            {t("Copy it now — it will not be shown again.")}
          </div>
        </div>
      )}

      <form
        onSubmit={create}
        className="card p-4 mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        <div>
          <label className="block text-xs text-graphite mb-1">
            {t("User name")}
          </label>
          <input
            className="focus-ring w-full bg-paper border border-mist rounded-xl px-3 py-2 text-sm text-ink"
            placeholder={t("User name")}
            value={user}
            onChange={(e) => setUser(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-graphite mb-1">
            {t("Expiration")}
          </label>
          <input
            type="datetime-local"
            className="focus-ring w-full bg-paper border border-mist rounded-xl px-3 py-2 text-sm text-ink"
            value={expiration}
            onChange={(e) => setExpiration(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-graphite mb-1">
            {t("ACL tags (e.g. tag:server)")}
          </label>
          <input
            className="focus-ring w-full bg-paper border border-mist rounded-xl px-3 py-2 text-sm text-ink"
            placeholder={t("ACL tags (e.g. tag:server)")}
            value={aclTags}
            onChange={(e) => setAclTags(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-5 text-sm text-graphite">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              className="accent-ember"
              checked={reusable}
              onChange={(e) => setReusable(e.target.checked)}
            />
            {t("Reusable")}
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              className="accent-ember"
              checked={ephemeral}
              onChange={(e) => setEphemeral(e.target.checked)}
            />
            {t("Ephemeral")}
          </label>
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="bg-ember hover:bg-ember-600 text-[color:var(--on-ember)] px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            {t("Create key")}
          </button>
        </div>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-fog text-graphite text-left">
              <th className="p-3 font-medium">{t("ID")}</th>
              <th className="p-3 font-medium">{t("User")}</th>
              <th className="p-3 font-medium">{t("Reusable")}</th>
              <th className="p-3 font-medium">{t("Expiration")}</th>
              <th className="p-3 font-medium">{t("Tags")}</th>
              <th className="p-3 font-medium text-right">{t("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr
                key={k.id}
                className="border-t border-mist hover:bg-fog transition-colors"
              >
                <td className="p-3 text-ink font-mono text-xs">
                  {k.id}
                </td>
                <td className="p-3 text-graphite">
                  {typeof k.user === "string"
                    ? k.user || "—"
                    : (k.user?.name ?? "—")}
                </td>
                <td className="p-3">
                  <Pill on={!!k.reusable} yes={t("yes")} no={t("no")} />
                </td>
                <td className="p-3 text-graphite text-xs">
                  {k.expiration ?? "—"}
                </td>
                <td className="p-3 text-graphite text-xs">
                  {(k.aclTags ?? []).join(" ") || "—"}
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button
                    className="text-[color:var(--warning)] hover:bg-[color:var(--warning-bg)] px-2 py-1 rounded-md text-xs font-medium transition-colors"
                    onClick={() =>
                      run(t("Expire failed"), () => api.expirePreAuthKey(k.id))
                    }
                  >
                    {t("Expire")}
                  </button>
                  <button
                    className="text-[color:var(--danger)] hover:bg-[color:var(--danger-bg)] px-2 py-1 rounded-md text-xs font-medium transition-colors"
                    onClick={() =>
                      run(t("Delete failed"), () => api.deletePreAuthKey(k.id))
                    }
                  >
                    {t("Delete")}
                  </button>
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-steel">
                  {t("No keys")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {busy && (
        <div className="text-steel text-sm mt-2">{t("Loading…")}</div>
      )}
    </div>
  );
}
