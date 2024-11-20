"use strict";

const rootConfig = {
  reporters: ["default"],
  automock: false,
  bail: false,
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: ["**/src/index.js"],
  coverageDirectory: "reports/coverage/unit/",
  coverageReporters: ["lcov", "text"],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 95,
      lines: 90,
      statements: 90,
    },
  },
  moduleDirectories: ["node_modules"],
  resetMocks: false,
  resetModules: false,
  verbose: true,
  maxWorkers: 2,
};

const projectBaseConfig = {
  setupFilesAfterEnv: ["./jest.setup.js"],
  testPathIgnorePatterns: ["/node_modules/"],
  modulePathIgnorePatterns: [],
};

module.exports = {
  projects: [
    {
      ...projectBaseConfig,
      displayName: "sqlite",
      testMatch: ["**/test/**/*.test.js"],
    },
    {
      ...projectBaseConfig,
      displayName: "hana",
      testMatch: ["**/test-hana/**/*.test.js"],
    },
    {
      ...projectBaseConfig,
      displayName: "postgres",
      testMatch: ["**/test-postgres/**/*.test.js"],
    },
  ],
  ...rootConfig,
};
