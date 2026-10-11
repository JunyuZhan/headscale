/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brex design language — "white concrete, single ember".
        // Base + semantic tokens are CSS-variable driven so the whole UI
        // switches between light (:root) and dark ([data-theme="dark"]) by
        // flipping one attribute on <html>; JSX class names stay untouched.
        ember: { DEFAULT: "#ff5900", 600: "#e64f00", 700: "#c94500" },
        abyss: "#000710",
        carbon: "var(--auth-panel)",
        ink: "var(--ink)",
        paper: "var(--paper)",
        fog: "var(--fog)",
        mist: "var(--mist)",
        steel: "var(--steel)",
        pewter: "var(--pewter)",
        graphite: "var(--graphite)",
        // Semantic status encoding (data, not brand decoration).
        live: { DEFAULT: "var(--success)", soft: "var(--success-bg)" },
        // Interim alias: pages not yet migrated keep rendering coherently
        // instead of falling back to the old blue.
        brand: {
          50: "#fff3ec",
          100: "#ffe1d2",
          300: "#ffb98f",
          400: "#ff8a4d",
          500: "#ff5900",
          600: "#ff5900",
          700: "#c94500",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          '"PingFang SC"',
          '"Microsoft YaHei"',
          "sans-serif",
        ],
      },
      letterSpacing: {
        display: "-0.03em",
        heading: "-0.02em",
        ui: "-0.011em",
      },
    },
  },
  plugins: [],
};
