"use strict";

const supertest = require("supertest");
const fs = require("fs");

const env = require("./_env");
const util = require("./_env/util");

let context;
let request;

describe("request", () => {
  beforeAll(async () => {
    context = await env("authmodel");
    request = supertest(context.app);
  });

  afterAll(() => {
    env.end(context);
  });

  it("GET $metadata auth", async () => {
    const response = await util.callRead(request, "/v2/auth/$metadata", {
      accept: "application/xml"
    });
    expect(response.status).toEqual(403);
  });
});
