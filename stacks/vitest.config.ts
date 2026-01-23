/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "clarinet",
    pool: "forks",
    setupFiles: ["./node_modules/@hirosystems/clarinet-sdk/vitest-helpers/src/vitest.setup.ts"],
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    environmentOptions: {
      clarinet: {
        manifestPath: "./Clarinet.toml"
      }
    },
    include: ["tests/**/*.test.ts"],
  },
});
