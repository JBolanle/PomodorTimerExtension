import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { copyFileSync } from "fs";

export default defineConfig({
  root: "src",
  publicDir: resolve(__dirname, "public"),
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "copy-manifest",
      writeBundle() {
        copyFileSync(
          resolve(__dirname, "manifest.json"),
          resolve(__dirname, "dist/manifest.json"),
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
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
});
