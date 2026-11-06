import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Workers Builds sets WORKERS_CI, so Cloudflare serves from "/". GitHub Pages serves from "/palmares/".
  base: process.env.BASE_PATH ?? (process.env.WORKERS_CI ? "/" : "/palmares/"),
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
});
