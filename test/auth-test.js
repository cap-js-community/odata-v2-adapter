"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");

const util = require("./_env/util/request");

cds.test(__dirname + "/_env");

let request;

describe("auth", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app);
  });

  it("GET $metadata auth", async () => {
    let response = await util.callRead(request, "/v2/auth/$metadata", {
      accept: "application/xml",
    });
    expect(response.status).toEqual(401);
    expect(response.headers["www-authenticate"]).toEqual('Basic realm="Users"');

    let authorization = `Basic ${Buffer.from(
      `${cds.requires.auth.users.bob.id}:${cds.requires.auth.users.bob.password}`
    ).toString("base64")}`;
    response = await util.callRead(request, "/v2/auth/$metadata", {
      accept: "application/xml",
      Authorization: authorization,
    });
    expect(response.status).toEqual(403);

    authorization = `Basic ${Buffer.from(
      `${cds.requires.auth.users.alice.id}:${cds.requires.auth.users.alice.password}`
    ).toString("base64")}`;
    response = await util.callRead(request, "/v2/auth/$metadata", {
      accept: "application/xml",
      Authorization: authorization,
    });
    expect(response.status).toEqual(200);

    authorization = `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c`;
    response = await util.callRead(request, "/v2/auth/$metadata", {
      accept: "application/xml",
      Authorization: authorization,
    });
    expect(response.status).toEqual(401);
  });

  it("GET $metadata invalid auth", async () => {
    const consoleSpy = jest.spyOn(console, "error");
    let authorization = `Bearer xyz`;
    let response = await util.callRead(request, "/v2/auth/$metadata", {
      accept: "application/xml",
      Authorization: authorization,
    });
    expect(response.status).toEqual(401);
    expect(consoleSpy).toHaveBeenCalledWith(
      "[cov2ap/Authorization] -",
      expect.objectContaining(new Error("Invalid JWT token"))
    );
  });

  it("GET $metadata check response correlation", async () => {
    const authorization = `Basic ${Buffer.from(
      `${cds.requires.auth.users.alice.id}:${cds.requires.auth.users.alice.password}`
    ).toString("base64")}`;
    const response = await util.callRead(request, "/v2/auth/$metadata", {
      accept: "application/xml",
      Authorization: authorization,
    });
    expect(response.status).toEqual(200);
    expect(response.headers["x-request-id"]).toBeDefined();
    expect(response.headers["x-correlation-id"]).toBeDefined();
    expect(response.headers["x-correlationid"]).toBeDefined();
  });
});
