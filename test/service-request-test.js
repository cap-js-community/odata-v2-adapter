"use strict";

const supertest = require("supertest");
const fs = require("fs");

const env = require("./_env");
const util = require("./_env/util");
const init = require("./_env/data/init");

let request;

describe("service-request", () => {
  beforeAll(async () => {
    const context = await env("servicemodel", 0, init);
    request = supertest(context.app);
  });

  afterAll(async () => {
    await env.end();
  });

  it("GET service", async () => {
    const response = await util.callRead(request, "/v2/dummy", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        EntitySets: ["Header", "HeaderItem"],
      },
    });
  });

  it("GET service data", async () => {
    const response = await util.callRead(request, "/v2/dummy/Header", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length > 0).toEqual(true);
  });

  it("GET service case sensitive", async () => {
    const response = await util.callRead(request, "/v2/Dummy/Header", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length > 0).toEqual(true);
    expect(response.body.d.results[0].__metadata).toBeDefined();
  });
});
