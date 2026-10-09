/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          500: "#2f7be4",
          600: "#1f63c2",
          700: "#194f9c",
        },
      },
    },
  },
  plugins: [],
};
