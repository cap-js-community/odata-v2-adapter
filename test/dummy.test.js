"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");

const util = require("./_env/util/request");

cds.test(__dirname + "/_env");

let request;

describe("dummy", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app.server);
  });

  it("GET service", async () => {
    const response = await util.callRead(request, "/odata/v2/dummy", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.body.d.EntitySets.sort()).toEqual(
      ["Header", "HeaderItem", "HeaderLine", "Header_texts", "HeaderItem_texts"].sort(),
    );
  });

  it("GET service data", async () => {
    const response = await util.callRead(request, "/odata/v2/dummy/Header", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length > 0).toEqual(true);
  });

  it("GET service case sensitive", async () => {
    const response = await util.callRead(request, "/odata/v2/Dummy/Header", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length > 0).toEqual(true);
    expect(response.body.d.results[0].__metadata).toBeDefined();
  });
});
