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
      `${cds.requires.auth.users.bob.ID}:${cds.requires.auth.users.bob.password}`
    ).toString("base64")}`;
    response = await util.callRead(request, "/v2/auth/$metadata", {
      accept: "application/xml",
      Authorization: authorization,
    });
    expect(response.status).toEqual(403);

    authorization = `Basic ${Buffer.from(
      `${cds.requires.auth.users.alice.ID}:${cds.requires.auth.users.alice.password}`
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
});
