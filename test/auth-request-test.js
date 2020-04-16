"use strict";

const supertest = require("supertest");
const fs = require("fs");

const env = require("./_env");
const util = require("./_env/util");

let context;
let request;

const options = {
  passport: {
    strategy: "mock",
    users: {
      alice: {
        password: "alice",
        ID: "alice@wonder.land",
        roles: ["XYZ4711"]
      },
      bob: {
        password: "bob",
        ID: "bob@builder.com",
        roles: []
      }
    }
  }
};

describe("auth-request", () => {
  beforeAll(async () => {
    context = await env("authmodel", 0, undefined, options);
    request = supertest(context.app);
  });

  afterAll(() => {
    env.end(context);
  });

  it("GET $metadata auth", async () => {
    let response = await util.callRead(request, "/v2/auth/$metadata", {
      accept: "application/xml"
    });
    expect(response.status).toEqual(401);
    expect(response.headers["www-authenticate"]).toEqual('Basic realm="Users"');

    let authorization = `Basic ${Buffer.from(
      `${options.passport.users.bob.ID}:${options.passport.users.bob.password}`
    ).toString("base64")}`;
    response = await util.callRead(request, "/v2/auth/$metadata", {
      accept: "application/xml",
      Authorization: authorization
    });
    expect(response.status).toEqual(403);

    authorization = `Basic ${Buffer.from(
      `${options.passport.users.alice.ID}:${options.passport.users.alice.password}`
    ).toString("base64")}`;
    response = await util.callRead(request, "/v2/auth/$metadata", {
      accept: "application/xml",
      Authorization: authorization
    });
    expect(response.status).toEqual(200);
  });
});
