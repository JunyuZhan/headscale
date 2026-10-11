import { useEffect, useState } from "react";
import { useI18n } from "../i18n";

// Detects browser auto-translation. When the app is in Simplified mode it
// never emits these Traditional-only phrases; if they appear in the DOM, some
// extension or the browser's built-in translator rewrote our text. Shows a
// banner so the user can tell a server bug from a client-side translation.
const CANARIES = [
  "總覽", "節點", "使用者", "登入", "帳號", "設定", "資訊", "紀錄",
  "驗證", "儲存", "顯示", "電子郵件", "複製", "裝置", "金鑰", "存取",
];

export default function TranslationBanner() {
  const { lang } = useI18n();
  const [translated, setTranslated] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setTranslated(false);
    setDismissed(false);
    if (lang !== "zh-Hans") return;
    const check = () => {
      const body = document.body.innerText || "";
      if (CANARIES.some((c) => body.includes(c))) setTranslated(true);
    };
    const t1 = window.setTimeout(check, 1000);
    const t2 = window.setTimeout(check, 3000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [lang]);

  if (lang !== "zh-Hans" || !translated || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-[color:var(--banner-bg)] border-b border-[color:var(--banner-border)] px-6 py-2.5 flex items-start gap-3 text-[13px] text-[color:var(--banner-text)]">
      <svg viewBox="0 0 24 24" className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="flex-1">
        <span className="font-semibold">检测到本页文字被浏览器翻译成了繁体。</span>
        这不是网站问题——请点击地址栏的翻译图标选择「不翻译此网站」或「保留原文」，并关闭翻译类扩展（Google 翻译 / 沉浸式翻译 / Mate 等），然后按 Cmd/Ctrl+Shift+R 硬刷新即可恢复简体。
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-[color:var(--banner-text)] hover:text-ink shrink-0 text-sm leading-none"
        title="关闭提示"
      >
        ✕
      </button>
    </div>
  );
}
