"use strict";

const globals = require("globals");
const js = require("@eslint/js");

const nodePlugin = require("eslint-plugin-n");
const jestPlugin = require("eslint-plugin-jest");
const configPrettier = require("eslint-config-prettier");
// const typescriptPlugin = require("typescript-eslint");

// https://eslint.org/docs/latest/use/configure/configuration-files
// https://eslint.org/docs/rules/
module.exports = [
  {
    ignores: ["**/node_modules/", "**/reports/", "**/temp/", "**/test/", "**/test-hana/", "**/test-postgres/"],
  },
  js.configs.recommended,
  nodePlugin.configs["flat/recommended-script"],
  jestPlugin.configs["flat/recommended"],
  configPrettier,
  /*...typescriptPlugin.configs["recommended"].map((config) => {
    return {
      files: ["*.ts"],
      ...config,
    };
  }),*/
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "commonjs",
      parserOptions: {
        project: true,
        tsconfigRootDir: __dirname,
      },
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
        STREAM: false,
      },
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
      "@typescript-eslint/no-var-requires": ["off"],
    },
  },
];
