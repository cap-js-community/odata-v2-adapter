"use strict";

const globals = require("globals");
const js = require("@eslint/js");

const nodePlugin = require("eslint-plugin-n");
const jestPlugin = require("eslint-plugin-jest");
const configPrettier = require("eslint-config-prettier");

// https://eslint.org/docs/latest/use/configure/configuration-files
// https://eslint.org/docs/rules/
module.exports = [
  {
    ignores: ["**/node_modules/", "**/temp/", "**/reports/", "**/test/", "**/test-integration/"]
  },
  js.configs.recommended,
  nodePlugin.configs["flat/recommended-script"],
  jestPlugin.configs["flat/recommended"],
  // typescriptPlugin.configs["flat/eslint-recommended"]
  // typescriptPlugin.configs["flat/recommended"]
  configPrettier,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        sap: false,
        cds: false,
        SELECT: false,
        INSERT: false,
        UPDATE: false,
        UPSERT: false,
        DELETE: false,
        CREATE: false,
        DROP: false,
        STREAM: false
      }
    },
    rules: {
      strict: ["error"],
      curly: ["error"],
      "no-unused-vars": ["off"],
      "no-restricted-modules": ["off"],
      "no-eval": ["error"],
      "no-implied-eval": ["error"],
      "no-console": ["error"],
      "no-throw-literal": ["error"],
      "no-control-regex": ["off"],
      "no-constant-binary-expression": ["off"],
      "no-inner-declarations": ["off"],
      "prefer-promise-reject-errors": ["error"],
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-var": ["error"],
      "no-prototype-builtins": ["off"],
      "n/no-extraneous-require": ["off"],
      "n/no-unpublished-require": ["off"],
      "n/no-unsupported-features/node-builtins": ["off"],
      "n/no-deprecated-api": ["off"],
      "jest/no-conditional-expect": ["off"],
      "jest/no-disabled-tests": ["off"],
      "@typescript-eslint/no-unused-vars": ["off"],
      "@typescript-eslint/no-var-requires": ["off"]
    }
  }
];
