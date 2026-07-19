import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["apps/*/src/**/*.ts", "packages/*/src/**/*.ts"],
    },
    include: ["apps/*/test/**/*.test.ts", "packages/*/test/**/*.test.ts"],
    hookTimeout: 30_000,
    testTimeout: 15_000,
  },
});
