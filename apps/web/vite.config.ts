import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const daemon = process.env["OPENSPACES_DAEMON"] ?? "http://127.0.0.1:3210";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: daemon, changeOrigin: false, headers: { origin: daemon } },
      "/auth": { target: daemon, changeOrigin: false },
    },
  },
  build: { outDir: "dist", sourcemap: false },
});
