import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Workers Builds sets WORKERS_CI. The admin page only works next to the Worker, so the
// GitHub Pages build leaves it out.
const workers = Boolean(process.env.WORKERS_CI);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Workers Builds sets WORKERS_CI, so Cloudflare serves from "/". GitHub Pages serves from "/palmares/".
  base: process.env.BASE_PATH ?? (workers ? "/" : "/palmares/"),
  build: {
    outDir: "dist",
    assetsDir: "assets",
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        ...(workers ? { admin: resolve(import.meta.dirname, "admin/index.html") } : {}),
      },
    },
  },
  // The webp encoder loads its WebAssembly from a URL next to its own file. Pre-bundling moves the
  // file and breaks that URL in `npm run dev`.
  optimizeDeps: { exclude: ["@jsquash/webp"] },
  server: {
    // `npx wrangler dev` runs the Worker on 8787. The proxy keeps the Origin of the browser.
    proxy: { "/api": "http://localhost:8787" },
  },
});
