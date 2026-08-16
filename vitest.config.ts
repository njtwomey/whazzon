import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

/**
 * One test runner for the whole repo: pipeline tests are plain node, web tests
 * opt into jsdom per file with `@vitest-environment jsdom`.
 *
 * The aliases have to mirror web/tsconfig.json — without them a component test
 * fails to resolve `@/...` even though the app builds, which looks like a
 * broken component rather than a missing config.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "web/src"),
      "@pipeline": resolve(import.meta.dirname, "packages/pipeline/src"),
    },
  },
  test: {
    include: ["packages/**/*.test.ts", "web/src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    globals: false,
  },
});
