import { defineConfig } from "vite";

export default defineConfig({
  base: "/zoom-sdk/",
  build: {
    outDir: "../public/zoom-sdk",
    emptyOutDir: true,
    target: "es2020"
  }
});
