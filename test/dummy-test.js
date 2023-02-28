"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");

const util = require("./_env/util/request");

cds.test(__dirname + "/_env");

let request;

describe("dummy", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app);
  });

  it("GET service", async () => {
    const response = await util.callRead(request, "/v2/dummy", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        EntitySets: ["Header", "HeaderItem", "HeaderLine"],
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
