"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");

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
  `${cds.requires.auth.users.alice.ID}:${cds.requires.auth.users.alice.password}`
).toString("base64")}`;

cds.services["cds.xt.ModelProviderService"] = {
  getCsn: jest.fn(async () => {
    return csn;
  }),
  getEdmx: jest.fn(async () => {
    return edmx;
  }),
  isExtended: jest.fn(async () => {
    return true;
  }),
};

describe("mtx", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app);
  });

  it("MTX $metadata (streamlined)", async () => {
    cds.env.requires.multitenancy = true;
    cds.env.requires["cds.xt.ModelProviderService"] = true;
    const response = await util.callRead(request, "/v2/main/$metadata", {
      accept: "application/xml",
      Authorization: authorization,
      tenant: "tenant",
    });
    expect(response.body).toBeDefined();
    expect(response.text).toEqual(edmx);
    expect(cds.services["cds.xt.ModelProviderService"].getCsn).toHaveBeenCalled();
    expect(cds.services["cds.xt.ModelProviderService"].getEdmx).toHaveBeenCalled();
    expect(cds.services["cds.xt.ModelProviderService"].isExtended).toHaveBeenCalled();
  });

  it("MTX event emitter", async () => {
    // not yet available
    expect(true).toEqual(true);
  });
});
