// Phase 0 build spike — compiles src/background/main.ts into a single
// classic (IIFE) bundle at dist-spike/background/service-worker.js.
//
// The IIFE format is required because:
//   - Chrome MV3 service workers default to classic scripts unless
//     `"type": "module"` is set in the manifest (we don't).
//   - Firefox's `background.scripts` array does not support ES modules.
//
// Output layout lets you load `dist-spike/` in Chrome or Firefox to verify
// the TS-authored SW boots and responds to `ping`.

import { defineConfig } from "vite";
import { resolve } from "path";
import { writeFileSync, mkdirSync } from "fs";

const browser = process.env.BROWSER || "chrome";
const outDir = "dist-spike";

// Minimal manifest for the spike — just enough to load the extension and
// verify the SW runs. Not production shape.
const spikeManifest = {
  manifest_version: 3,
  name: "Pomodoro SW Spike",
  version: "0.0.1",
  description: "Phase 0 spike — TypeScript SW build verification.",
  permissions: [] as string[],
  background:
    browser === "firefox"
      ? { scripts: ["background/service-worker.js"] }
      : { service_worker: "background/service-worker.js" },
  ...(browser === "firefox"
    ? {
        browser_specific_settings: {
          gecko: {
            id: "pomodoro-spike@example.com",
            strict_min_version: "128.0",
          },
        },
      }
    : {}),
};

export default defineConfig({
  plugins: [
    {
      name: "emit-spike-manifest",
      writeBundle() {
        const dir = resolve(__dirname, outDir);
        mkdirSync(dir, { recursive: true });
        writeFileSync(
          resolve(dir, "manifest.json"),
          JSON.stringify(spikeManifest, null, 2),
        );
      },
    },
  ],
  build: {
    target: "esnext",
    outDir: resolve(__dirname, outDir),
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "src/background/main.ts"),
      name: "PomodoroServiceWorker",
      formats: ["iife"],
      fileName: () => "background/service-worker.js",
    },
    rollupOptions: {
      output: {
        // IIFE bundles inline everything — no imports at runtime.
        inlineDynamicImports: true,
      },
    },
  },
});
