"use strict";

jest.setTimeout(30000); // in milliseconds (30 sec)

beforeAll(async () => {
  await global._init;
});