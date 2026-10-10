import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
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
