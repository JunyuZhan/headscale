import { useState } from "react";
import { THEME_KEY, type Theme, applyTheme } from "../lib/theme";

const OPTIONS: { value: Theme; label: string; icon: "sun" | "moon" | "auto" }[] =
  [
    { value: "light", label: "浅色", icon: "sun" },
    { value: "dark", label: "深色", icon: "moon" },
    { value: "system", label: "跟随系统", icon: "auto" },
  ];

export default function ThemeToggle() {
  const [pref, setPref] = useState<Theme>(
    ((typeof localStorage !== "undefined" &&
      localStorage.getItem(THEME_KEY)) ||
      "system") as Theme,
  );

  const choose = (v: Theme) => {
    setPref(v);
    localStorage.setItem(THEME_KEY, v);
    applyTheme(v);
  };

  return (
    <div className="flex items-center gap-0.5 text-xs border border-mist rounded-xl p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => choose(o.value)}
          title={o.label}
          className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
            pref === o.value
              ? "bg-fog text-ember"
              : "text-graphite hover:bg-fog hover:text-ink"
          }`}
        >
          <ThemeIcon name={o.icon} />
        </button>
      ))}
    </div>
  );
}

function ThemeIcon({ name }: { name: "sun" | "moon" | "auto" }) {
  const cls = "w-4 h-4";
  if (name === "sun") {
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  if (name === "moon") {
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
      </svg>
    );
  }
  return (
    <svg
      className={cls}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M3 9h18M8 4v14" />
    </svg>
  );
}
