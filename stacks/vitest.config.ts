/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "clarinet",
    pool: "forks",
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
