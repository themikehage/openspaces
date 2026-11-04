import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts", "test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/core/src/**", "packages/protocol/src/**"],
      exclude: ["**/*.test.ts"],
    },
  },
});
