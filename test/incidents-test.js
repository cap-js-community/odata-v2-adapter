"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");

const util = require("./_env/util/request");

cds.test(__dirname + "/_env");

let request;

describe("incidents", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app.server);
  });

  it("GET incidents service", async () => {
    const response = await util.callRead(request, "/v2/incidents", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.body.d.EntitySets.sort()).toMatchSnapshot();
  });

  it("GET incidents service data", async () => {
    const response = await util.callRead(request, "/v2/incidents/Incidents", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length > 0).toEqual(true);
  });
});
