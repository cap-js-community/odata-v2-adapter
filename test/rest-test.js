"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");

const util = require("./_env/util/request");

cds.test(__dirname + "/_env");

let request;

describe("rest", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app);
  });

  it("GET rest", async () => {
    const response = await util.callRead(request, "/rest/Header", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.body.length).toEqual(7);
  });

  it("GET reject rest for V2", async () => {
    let response = await util.callRead(request, "/v2/rest/$metadata", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.text).toEqual("Invalid service protocol. Only OData services supported");

    response = await util.callRead(request, "/v2/rest/Header", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.text).toEqual("Invalid service protocol. Only OData services supported");
  });
});
