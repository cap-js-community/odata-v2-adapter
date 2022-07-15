"use strict";

const baseConfig = require("./jest.config");

module.exports = {
  ...baseConfig,
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 95,
      lines: 90,
      statements: 90,
    },
  },
  testMatch: ["**/test/**/*-test.js"],
};
