"use strict";

const config = require("./jest.config");

module.exports = {
  ...config,
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 90,
      lines: 85,
      statements: 85,
    },
  },
  testMatch: ["**/test/**/*-test.js"],
};
