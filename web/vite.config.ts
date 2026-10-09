import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The SPA is served by headscale itself under /ui, so the base path must match.
// Build output is written straight into the Go package so it can be embedded.
export default defineConfig({
  plugins: [react()],
  base: "/ui/",
  build: {
    outDir: "../hscontrol/webui/dist",
    emptyOutDir: true,
  },
});
