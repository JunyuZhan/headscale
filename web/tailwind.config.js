/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brex design language — "white concrete, single ember".
        ember: { DEFAULT: "#ff5900", 600: "#e64f00", 700: "#c94500" },
        abyss: "#000710",
        carbon: "#15191e",
        ink: "#000000",
        paper: "#ffffff",
        fog: "#f3f3f7",
        mist: "#b9bbc6",
        steel: "#8b8d98",
        pewter: "#6f737b",
        graphite: "#60646c",
        // Semantic status encoding (data, not brand decoration).
        live: { DEFAULT: "#0f9d63", soft: "#e6f5ee" },
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
