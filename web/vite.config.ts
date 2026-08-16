import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

/**
 * Static hosts serve a file per path. This app routes client-side, so a direct
 * hit on /bristol-uk/theatre asks for a file that does not exist and gets a 404
 * — the index is only served at /.
 *
 * GitHub Pages (and Netlify, and S3) fall back to 404.html for unknown paths,
 * so making it a copy of index.html hands those URLs to the router instead.
 * Without this every link into the site except the root is broken, which is not
 * visible in dev because vite's server already falls back.
 */
function spaFallback(): Plugin {
  return {
    name: "whazzon:spa-fallback",
    apply: "build",
    closeBundle() {
      const dist = resolve(import.meta.dirname, "dist");
      copyFileSync(resolve(dist, "index.html"), resolve(dist, "404.html"));
      this.info?.("wrote 404.html for client-side routing");
    },
  };
}

// GitHub Pages serves a project site from /<repo>/, so the base path has to be
// configurable without editing this file. Set VITE_BASE=/whazzon/ when building
// for Pages; the default suits local dev and a root-domain deploy.
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react(), tailwindcss(), spaFallback()],
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "src") },
  },
});
