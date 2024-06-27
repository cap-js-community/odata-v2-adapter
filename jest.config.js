"use strict";

module.exports = {
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
  modulePathIgnorePatterns: [],
  resetMocks: false,
  resetModules: false,
  testMatch: ["**/test/**/*.test.js", "**/test-hana/**/*.test.js"],
  testPathIgnorePatterns: ["/node_modules/"],
  verbose: true,
  maxWorkers: 2,
  setupFilesAfterEnv: ["./jest.setup.js"],
};
