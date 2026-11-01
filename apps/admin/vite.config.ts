import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development the API is proxied so the refresh-token cookie is same-origin.
export default defineConfig({
  plugins: [react()],
  // Relative asset paths for the self-contained demo build (VITE_DEMO=1).
  base: process.env.VITE_DEMO ? "./" : "/",
  server: {
    port: 5173,
    proxy: { "/api": { target: process.env.API_PROXY_TARGET ?? "http://localhost:4000", changeOrigin: false } },
  },
});
