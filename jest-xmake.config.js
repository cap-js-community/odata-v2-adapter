"use strict";

const baseConfig = require("./jest.config");

module.exports = {
  ...baseConfig,
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  testMatch: ["**/test/**/*-test.js"],
};
