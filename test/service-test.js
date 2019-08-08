"use strict";

const supertest = require("supertest");
const fs = require("fs");

const env = require("./_env");
const util = require("./_env/util");
const init = require("./_env/data/init");

let context;
let request;

describe("request", () => {
  beforeAll(async () => {
    context = await env("servicemodel", 0, init);
    request = supertest(context.app);
  });

  afterAll(() => {
    env.end(context);
  });

  it("GET service", async () => {
    const response = await util.callRead(request, "/v2/dummy/Header", {
      accept: "application/json"
    });
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length > 0).toEqual(true);
  });
});
