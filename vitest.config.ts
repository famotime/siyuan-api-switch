import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "siyuan": resolve(__dirname, "tests/mocks/siyuan.ts"),
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
  },
});
