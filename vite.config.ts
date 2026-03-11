import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { readFileSync, writeFileSync } from "fs";

const browser = process.env.BROWSER || "chrome";
const outDir = browser === "firefox" ? "dist-firefox" : "dist";

export default defineConfig({
  root: "src",
  publicDir: resolve(__dirname, "public"),
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "copy-manifest",
      writeBundle() {
        const manifest = JSON.parse(
          readFileSync(resolve(__dirname, "manifest.json"), "utf-8"),
        );

        if (browser === "firefox") {
          manifest.background = {
            scripts: [manifest.background.service_worker],
          };
          manifest.browser_specific_settings = {
            gecko: {
              id: "pomodoro-timer@example.com",
              strict_min_version: "109.0",
            },
          };
        }

        writeFileSync(
          resolve(__dirname, `${outDir}/manifest.json`),
          JSON.stringify(manifest, null, 2),
        );
      },
    },
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  base: "",
  build: {
    target: "esnext",
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/index.html"),
        options: resolve(__dirname, "src/options/index.html"),
      },
    },
    outDir: resolve(__dirname, outDir),
    emptyOutDir: true,
  },
});
