"use strict";

const supertest = require("supertest");

const env = require("./_env");
const util = require("./_env/util");

let request;

const options = {
  auth: {
    strategy: "mock",
    users: {
      alice: {
        password: "alice",
        ID: "alice@wonder.land",
        roles: ["XYZ4711"],
      },
      bob: {
        password: "bob",
        ID: "bob@builder.com",
        roles: [],
      },
    },
  },
};

describe("auth-request", () => {
  beforeAll(async () => {
    const context = await env("authmodel", 0, undefined, options);
    request = supertest(context.app);
  });

  afterAll(async () => {
    await env.end();
  });

  it("GET $metadata auth", async () => {
    let response = await util.callRead(request, "/v2/auth/$metadata", {
      accept: "application/xml",
    });
    expect(response.status).toEqual(401);
    expect(response.headers["www-authenticate"]).toEqual('Basic realm="Users"');

    let authorization = `Basic ${Buffer.from(
      `${options.auth.users.bob.ID}:${options.auth.users.bob.password}`
    ).toString("base64")}`;
    response = await util.callRead(request, "/v2/auth/$metadata", {
      accept: "application/xml",
      Authorization: authorization,
    });
    expect(response.status).toEqual(403);

    authorization = `Basic ${Buffer.from(
      `${options.auth.users.alice.ID}:${options.auth.users.alice.password}`
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
