import { useEffect, useState, type FormEvent } from "react";
import { admin, type MailSettings, type MailSettingsResp } from "../api/client";
import { useI18n } from "../i18n";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm text-graphite">{label}</span>
      {hint && <span className="ml-2 text-xs text-steel">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export default function Settings() {
  const { t } = useI18n();
  const [m, setM] = useState<MailSettings>({
    enabled: true,
    smtp_host: "",
    smtp_port: "587",
    smtp_username: "resend",
    smtp_password: "",
    smtp_from: "noreply@sclink.dev",
    smtp_tls: "starttls",
    resend_api_key: "",
    resend_from: "Headscale <no-reply@sclink.dev>",
    resend_notify_to: "",
  });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testMsg, setTestMsg] = useState("");

  useEffect(() => {
    admin
      .mailSettings()
      .then((r: MailSettingsResp) => setM(r.mail))
      .catch((e) => setErr((e as Error).message));
  }, []);

  const set = (k: keyof MailSettings, v: string | boolean) =>
    setM((p) => ({ ...p, [k]: v }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      const r = await admin.saveMailSettings(m);
      setM(r.mail);
      setMsg(t("Saved"));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setTestMsg("");
    setErr("");
    if (!testTo) {
      setErr(t("Test recipient required"));
      return;
    }
    setBusy(true);
    try {
      const r = await admin.testMail(testTo);
      setTestMsg(r.ok ? t("Test email sent") : r.error ?? "failed");
    } catch (e) {
      setTestMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "focus-ring w-full bg-paper border border-mist rounded-xl p-2 text-sm text-ink";

  return (
    <div className="max-w-3xl">
      <h1 className="text-[28px] leading-[1.3] tracking-heading font-semibold text-ink mb-1">
        {t("Mail settings")}
      </h1>
      <p className="text-graphite text-sm mb-6">
        {t("Enable email alerts")} · SMTP / Resend
      </p>

      {err && <div className="text-[#a32d2d] mb-4 text-sm">{err}</div>}
      {msg && <div className="text-live mb-4 text-sm">{msg}</div>}

      <form onSubmit={save} className="space-y-6">
        <div className="card p-5">
          <label className="flex items-center justify-between">
            <span className="text-sm text-ink">{t("Enable email alerts")}</span>
            <input
              type="checkbox"
              checked={m.enabled}
              onChange={(e) => set("enabled", e.target.checked)}
              className="w-5 h-5 accent-ember"
            />
          </label>
          <p className="text-xs text-steel mt-2">
            关闭后将不再发送告警邮件（节点入网 / 掉线 / 密钥过期），但相关事件仍会记入活动日志。
          </p>
        </div>

        <div className="card p-5 space-y-4">
          <h2 className="text-base font-medium text-ink">
            {t("SMTP configuration")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t("SMTP host")}>
              <input
                className={inputCls}
                value={m.smtp_host}
                placeholder="smtp.resend.com"
                onChange={(e) => set("smtp_host", e.target.value)}
              />
            </Field>
            <Field label={t("SMTP port")}>
              <input
                className={inputCls}
                value={m.smtp_port}
                placeholder="587"
                onChange={(e) => set("smtp_port", e.target.value)}
              />
            </Field>
            <Field label={t("SMTP username")}>
              <input
                className={inputCls}
                value={m.smtp_username}
                placeholder="resend"
                onChange={(e) => set("smtp_username", e.target.value)}
              />
            </Field>
            <Field label={t("Encryption")}>
              <select
                className={inputCls}
                value={m.smtp_tls}
                onChange={(e) => set("smtp_tls", e.target.value)}
              >
                <option value="starttls">{t("STARTTLS (587)")}</option>
                <option value="ssl">{t("Implicit TLS (465)")}</option>
              </select>
            </Field>
            <Field label={t("SMTP password")} hint={t("Leave blank to keep unchanged")}>
              <input
                type="password"
                className={inputCls}
                value={m.smtp_password}
                placeholder="••••••••"
                autoComplete="new-password"
                onChange={(e) => set("smtp_password", e.target.value)}
              />
            </Field>
            <Field label={t("From address")}>
              <input
                className={inputCls}
                value={m.smtp_from}
                placeholder="noreply@sclink.dev"
                onChange={(e) => set("smtp_from", e.target.value)}
              />
            </Field>
          </div>
          <p className="text-xs text-steel">
            Resend SMTP：用户名固定为 <code className="text-graphite">resend</code>，
            密码即你的 Resend API Key；发件域名需在 Resend 中已验证。
          </p>
        </div>

        <div className="card p-5 space-y-4">
          <h2 className="text-base font-medium text-ink">
            {t("Resend API key")}（备用）
          </h2>
          <p className="text-xs text-steel">
            若不使用 SMTP，可填 Resend REST API 密钥作为回退；两者都留空则不发信。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t("Resend API key")} hint={t("Leave blank to keep unchanged")}>
              <input
                type="password"
                className={inputCls}
                value={m.resend_api_key}
                placeholder="re_••••••••"
                autoComplete="new-password"
                onChange={(e) => set("resend_api_key", e.target.value)}
              />
            </Field>
            <Field label={t("Resend from")}>
              <input
                className={inputCls}
                value={m.resend_from}
                placeholder="Headscale <no-reply@sclink.dev>"
                onChange={(e) => set("resend_from", e.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <h2 className="text-base font-medium text-ink">
            {t("Alert recipients")}
          </h2>
          <Field label={t("Alert recipients")} hint={t("comma-separated emails")}>
            <input
              className={inputCls}
              value={m.resend_notify_to}
              placeholder="ops@example.com, admin@example.com"
              onChange={(e) => set("resend_notify_to", e.target.value)}
            />
          </Field>
          <p className="text-xs text-steel">
            留空时，系统会向「用户」页面中标记为管理员的邮箱发送告警。
          </p>
        </div>

        <div className="card p-5 space-y-3">
          <h2 className="text-base font-medium text-ink">发送测试邮件</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              className={inputCls}
              value={testTo}
              placeholder={t("Test recipient")}
              onChange={(e) => setTestTo(e.target.value)}
            />
            <button
              type="button"
              onClick={test}
              disabled={busy}
              className="shrink-0 bg-fog text-ink hover:bg-mist py-2 px-4 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {busy ? t("Loading…") : t("Send test email")}
            </button>
          </div>
          {testMsg && (
            <div className="text-sm text-graphite">{testMsg}</div>
          )}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-ember hover:bg-ember-600 text-paper py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {busy ? t("Loading…") : t("Save")}
        </button>
      </form>
    </div>
  );
}
