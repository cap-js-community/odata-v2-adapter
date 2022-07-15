"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");
const EventEmitter = require("node:events");

const util = require("../_env/util/request");

cds.test(__dirname + "/../_env");

let request;

const csn = {
  definitions: {
    "test.MainService": {
      kind: "service",
    },
  },
};
const edmx = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="1.0" xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" xmlns:sap="http://www.sap.com/Protocols/SAPData">
  <edmx:DataServices m:DataServiceVersion="2.0">
    <Schema Namespace="test.MainService" xmlns="http://schemas.microsoft.com/ado/2008/09/edm"/>
  </edmx:DataServices>
</edmx:Edmx>`;

const authorization = `Basic ${Buffer.from(
  `${cds.requires.auth.users.alice.id}:${cds.requires.auth.users.alice.password}`
).toString("base64")}`;

let errorExtended = false;
let errorCsn = false;
let errorEdmx = false;

cds.mtx = {
  eventEmitter: new EventEmitter(),
  events: {
    TENANT_UPDATED: "TENANT_UPDATED",
  },
  getCsn: jest.fn(async () => {
    if (errorCsn) {
      throw new Error("MTX getCsn Error");
    }
    return csn;
  }),
  getEdmx: jest.fn(async () => {
    if (errorEdmx) {
      throw new Error("MTX getEdmx Error");
    }
    return edmx;
  }),
  isExtended: jest.fn(async () => {
    if (errorExtended) {
      throw new Error("MTX isExtended Error");
    }
    return true;
  }),
};

describe("mtx", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app);
  });

  it("MTX $metadata (local)", async () => {
    cds.env.requires.multitenancy = true;
    const response = await util.callRead(request, "/v2/main/$metadata", {
      accept: "application/xml",
      Authorization: authorization,
    });
    expect(response.body).toBeDefined();
    expect(response.text).toEqual(edmx);
    expect(cds.mtx.getCsn).toHaveBeenCalled();
    expect(cds.mtx.getEdmx).toHaveBeenCalled();
    expect(cds.mtx.isExtended).toHaveBeenCalled();
  });

  it("MTX event emitter", async () => {
    const ok = cds.mtx.eventEmitter.emit(cds.mtx.events.TENANT_UPDATED, "tenant");
    expect(ok).toEqual(true);
  });

  it("MTX $metadata error resilient", async () => {
    const consoleSpy = jest.spyOn(console, "error");

    cds.env.requires.multitenancy = true;
    errorExtended = true;
    let response = await util.callRead(request, "/v2/main/$metadata", {
      accept: "application/xml",
      Authorization: authorization,
    });
    expect(response.status).toEqual(500);
    expect(response.text).toEqual("Internal Server Error");
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("MTX isExtended Error"));

    errorExtended = false;
    errorCsn = true;
    response = await util.callRead(request, "/v2/main/$metadata", {
      accept: "application/xml",
      Authorization: authorization,
    });
    expect(response.status).toEqual(500);
    expect(response.text).toEqual("Internal Server Error");
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("MTX getCsn Error"));

    errorCsn = false;
    errorEdmx = true;
    response = await util.callRead(request, "/v2/main/$metadata", {
      accept: "application/xml",
      Authorization: authorization,
    });
    expect(response.status).toEqual(500);
    expect(response.text).toEqual("Internal Server Error");
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("MTX getEdmx Error"));

    errorEdmx = false;
    response = await util.callRead(request, "/v2/main/$metadata", {
      accept: "application/xml",
      Authorization: authorization,
    });
    expect(response.body).toBeDefined();
    expect(response.text).toEqual(edmx);
    expect(cds.mtx.getCsn).toHaveBeenCalled();
    expect(cds.mtx.getEdmx).toHaveBeenCalled();
    expect(cds.mtx.isExtended).toHaveBeenCalled();
  });
});
