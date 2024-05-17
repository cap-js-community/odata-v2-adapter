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
    const response = await util.callRead(request, "/odata/v2/cache/$metadata", {
      accept: "application/xml",
    });
    expect(response.body).toBeDefined();
    expect(response.text).toMatchSnapshot();
  });

  it("GET Entity cache via prototype works", async () => {
    let response = await util.callWrite(
      request,
      "/odata/v2/cache/Header",
      {
        name: "Test",
      },
      false,
      {
        accept: "application/xml",
      },
    );
    expect(response.status).toBe(201);
    expect(response.body).toBeDefined();

    response = await util.callWrite(
      request,
      "/odata/v2/cache/HeaderMore",
      {
        name: "Test",
        dueAt: "/Date(1711152000000)/",
      },
      false,
      {
        accept: "application/xml",
      },
    );
    expect(response.status).toBe(201);
    expect(response.body).toBeDefined();
  });
});
