"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");

const util = require("./_env/util/request");

process.env.CDS_LOG_LEVELS_COV2AP = "debug";
const consoleDebugSpy = jest.spyOn(global.console, "debug");
consoleDebugSpy.mockImplementation(() => {
});

cds.test(__dirname + "/_env");

let request;

const validAuth = `Basic ${Buffer.from(
  `${cds.requires.auth.users.alice.id}:${cds.requires.auth.users.alice.password}`
).toString("base64")}`;

const invalidAuth = `Basic ${Buffer.from(
  `${cds.requires.auth.users.bob.id}:${cds.requires.auth.users.bob.password}`
).toString("base64")}`;

describe("auth", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app.server);
  });

  it("GET $metadata auth", async () => {
    let response = await util.callRead(request, "/odata/v2/auth/$metadata", {
      accept: "application/xml"
    });
    expect(response.status).toEqual(401);
    expect(response.headers["www-authenticate"]).toEqual("Basic realm=\"Users\"");

    response = await util.callRead(request, "/odata/v2/auth/$metadata", {
      accept: "application/xml",
      Authorization: invalidAuth
    });
    expect(response.status).toEqual(403);

    response = await util.callRead(request, "/odata/v2/auth/$metadata", {
      accept: "application/xml",
      Authorization: validAuth
    });
    expect(response.status).toEqual(200);

    response = await util.callRead(request, "/odata/v2/auth/$metadata", {
      accept: "application/xml",
      Authorization:
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    });
    expect(response.status).toEqual(401);
  });

  it("GET $metadata invalid auth", async () => {
    const consoleSpy = jest.spyOn(console, "error");
    let response = await util.callRead(request, "/odata/v2/auth/$metadata", {
      accept: "application/xml",
      Authorization: "Bearer xyz"
    });
    expect(response.status).toEqual(401);
    expect(consoleSpy).toHaveBeenCalledWith(
      "[cov2ap] -",
      "Authorization:",
      expect.objectContaining(new Error("Invalid JWT token"))
    );
    response = await util.callRead(request, "/odata/v2/auth/$metadata", {
      accept: "application/xml",
      Authorization: validAuth
    });
    expect(response.status).toEqual(200);
  });

  it("GET service root invalid auth", async () => {
    const consoleSpy = jest.spyOn(console, "error");
    let response = await util.callRead(request, "/odata/v2/auth/", {
      accept: "application/xml",
      Authorization: "Bearer xyz"
    });
    expect(response.status).toEqual(401);
    expect(consoleSpy).toHaveBeenCalledWith(
      "[cov2ap] -",
      "Authorization:",
      expect.objectContaining(new Error("Invalid JWT token"))
    );
    response = await util.callRead(request, "/odata/v2/auth/", {
      accept: "application/xml",
      Authorization: validAuth
    });
    expect(response.status).toEqual(200);
  });

  it("GET $metadata check response correlation", async () => {
    const response = await util.callRead(request, "/odata/v2/auth/$metadata", {
      accept: "application/xml",
      Authorization: validAuth
    });
    expect(response.status).toEqual(200);
    expect(response.headers["x-request-id"]).toBeDefined();
    expect(response.headers["x-correlation-id"]).toBeDefined();
    expect(response.headers["x-correlationid"]).toBeDefined();
  });

  it("GET sanitize authorization header for debug traces", async () => {
    consoleDebugSpy.mockReset();
    const response = await util.callRead(request, "/odata/v2/auth/Header", {
      accept: "application/xml",
      Authorization: validAuth
    });
    expect(response.status).toEqual(200);
    const traceRequest = consoleDebugSpy.mock.calls.find(call => call[1] === "Request:");
    expect(traceRequest).toBeDefined();
    expect(traceRequest[2]).toMatch(/Basic \*\*\*/)
    const traceProxyRequest = consoleDebugSpy.mock.calls.find(call => call[1] === "ProxyRequest:");
    expect(traceProxyRequest).toBeDefined();
    expect(traceProxyRequest[2]).toMatch(/Basic \*\*\*/)
    const traceResponse = consoleDebugSpy.mock.calls.find(call => call[1] === "Response:");
    expect(traceResponse).toBeDefined();
    const traceProxyResponse = consoleDebugSpy.mock.calls.find(call => call[1] === "ProxyResponse:");
    expect(traceProxyResponse).toBeDefined();
  });
});
