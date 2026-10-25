import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The API runs on its own port in development; Vite forwards /api calls to it
// so the browser sees one origin and auth cookies just work.
const apiTarget = process.env.VITE_DEV_API_PROXY ?? "http://localhost:8787";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  server: {
    port: 5173,
    proxy: { "/api": apiTarget, "/static": apiTarget },
  },
});
