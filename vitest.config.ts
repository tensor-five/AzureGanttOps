import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
    environmentMatchGlobs: [["src/**/*.spec.tsx", "jsdom"]]
  }
});
