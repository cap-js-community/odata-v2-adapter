"use strict";

require("@sap/hana-client/lib/index.js");

module.exports = {
  reporters: ["default"],
  automock: false,
  bail: false,
  clearMocks: true,
  collectCoverage: false,
  moduleDirectories: ["node_modules"],
  modulePathIgnorePatterns: [],
  resetMocks: false,
  resetModules: false,
  testMatch: ["**/integration-test/**/*-test.js"],
  testPathIgnorePatterns: ["/node_modules/"],
  testURL: "http://localhost/",
  verbose: true,
  setupFilesAfterEnv: ["./jest.setup.js"],
};
