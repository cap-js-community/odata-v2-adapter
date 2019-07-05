module.exports = {
  reporters: ["default"],
  automock: false,
  bail: false,
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: ["**/index.js", "!**/test/**/*.js", "!**/integration-test/**/*.js"],
  coverageDirectory: "reports/coverage/unit/",
  coverageReporters: ["lcov", "text"],
  coverageThreshold: {
    global: {
      branches: 84,
      functions: 96,
      lines: 94,
      statements: 94
    }
  },
  moduleDirectories: ["node_modules"],
  modulePathIgnorePatterns: [],
  resetMocks: false,
  resetModules: false,
  testMatch: ["**/test/**/*-test.js"],
  testPathIgnorePatterns: ["/node_modules/"],
  testURL: "http://localhost/",
  verbose: true
};
