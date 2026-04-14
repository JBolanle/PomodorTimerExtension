// Builds the TypeScript service worker (src/background/main.ts) into
// a single classic (IIFE) JS bundle at dist/background/service-worker.js
// (or dist-firefox/background/service-worker.js for the Firefox build).
//
// IIFE format is required because:
//   - Chrome MV3 service workers default to classic scripts unless
//     `"type": "module"` is set in the manifest (we don't).
//   - Firefox's `background.scripts` array does not support ES modules.
//
// Run AFTER the main `vite build` — uses `emptyOutDir: false` to emit
// into the pre-existing dist directory.

import { defineConfig } from "vite";
import { resolve } from "path";

const browser = process.env.BROWSER || "chrome";
const outDir = browser === "firefox" ? "dist-firefox" : "dist";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    target: "esnext",
    outDir: resolve(__dirname, outDir),
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/background/main.ts"),
      name: "PomodoroServiceWorker",
      formats: ["iife"],
      fileName: () => "background/service-worker.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
