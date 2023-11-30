"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");

const util = require("./_env/util/request");

cds.test(__dirname + "/_env");

let request;

describe("rest", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app.server);
  });

  it("GET $metadata", async () => {
    const response = await util.callRead(request, "/odata/v2/ignore/$metadata", {
      accept: "application/xml",
    });
    expect(response.statusCode).toEqual(400);
    expect(response.body).toBeDefined();
    expect(response.text).toMatchSnapshot();
  });

  it("GET data", async () => {
    const response = await util.callRead(request, "/odata/v2/ignore/Header");
    expect(response.statusCode).toEqual(400);
    expect(response.body).toBeDefined();
    expect(response.text).toMatchSnapshot();
  });
});
