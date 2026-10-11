export type Theme = "light" | "dark" | "system";
export const THEME_KEY = "hs-theme";

// Resolve a stored preference into the concrete light/dark theme to apply.
export function resolveTheme(pref: Theme): "light" | "dark" {
  if (pref === "system") {
    const mq =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)");
    return mq && mq.matches ? "dark" : "light";
  }
  return pref;
}

// Flip the single data-theme attribute on <html>; the CSS variable cascade
// does the rest.
export function applyTheme(pref: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolveTheme(pref);
}

// Called once at startup (after the head inline script) to register a live
// listener so "system" mode tracks OS changes.
export function initTheme() {
  const pref = (
    (typeof localStorage !== "undefined" && localStorage.getItem(THEME_KEY)) ||
    "system"
  ) as Theme;
  applyTheme(pref);
  if (typeof window !== "undefined" && window.matchMedia) {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    mql.addEventListener("change", () => {
      if ((localStorage.getItem(THEME_KEY) as Theme) === "system") {
        applyTheme("system");
      }
    });
  }
}
