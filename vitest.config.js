"use strict";

const { defineConfig } = require("vitest/config");

const isExternal = process.env.COV2AP_EXTERNAL === "true";

const thresholds = isExternal
  ? { branches: 65, functions: 85, lines: 85, statements: 85 }
  : { branches: 75, functions: 90, lines: 90, statements: 90 };

module.exports = defineConfig({
  test: {
    globals: true,
    clearMocks: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    reporters: ["default"],
    pool: "forks",
    maxWorkers: 2,
    coverage: {
      enabled: true,
      provider: "v8",
      include: ["src/index.js"],
      reportsDirectory: "reports/coverage/unit/",
      reporter: ["lcov", "text"],
      thresholds,
    },
    projects: [
      {
        extends: true,
        test: { name: "sqlite", include: ["test/**/*.test.js"] },
      },
      {
        extends: true,
        test: { name: "hana", include: ["test-hana/**/*.test.js"] },
      },
      {
        extends: true,
        test: { name: "postgres", include: ["test-postgres/**/*.test.js"] },
      },
    ],
  },
});
