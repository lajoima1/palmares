import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Workers Builds sets WORKERS_CI. The admin page only works next to the Worker, so the
// GitHub Pages build leaves it out.
const workers = Boolean(process.env.WORKERS_CI);

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => {
  // The Cloudflare build and `npm run dev` have both looks. The GitHub Pages build has only the
  // old look, and its bundle holds no code of the new one. `npm run preview` uses the base of the
  // build with the same WORKERS_CI: run both with it, or both without it.
  const looks = workers || (command === "serve" && !isPreview);

  return {
    plugins: [
      react(),
      {
        name: "looks-flag",
        // The first loading screen in index.html runs before the bundle, so it gets the flag here.
        transformIndexHtml: (html: string) => html.replaceAll("__LOOKS__", String(looks)),
      },
    ],
    // Cloudflare and `npm run dev` serve from "/". GitHub Pages serves from "/palmares/".
    base: process.env.BASE_PATH ?? (looks ? "/" : "/palmares/"),
    define: { __LOOKS__: JSON.stringify(looks) },
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
    // The webp encoder loads its WebAssembly from a URL next to its own file. Pre-bundling moves
    // the file and breaks that URL in `npm run dev`.
    optimizeDeps: { exclude: ["@jsquash/webp"] },
    server: {
      // `npx wrangler dev` runs the Worker on 8787. The proxy keeps the Origin of the browser.
      proxy: { "/api": "http://localhost:8787" },
    },
  };
});
