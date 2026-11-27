import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts", "src/**/*.spec.tsx", "scripts/**/*.spec.mjs"],
    setupFiles: ["src/shared/testing/vitest-jsdom-storage.ts"]
  }
});
