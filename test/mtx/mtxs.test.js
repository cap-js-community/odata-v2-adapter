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
    "test.MainService.Header": {
      kind: "entity",
      elements: {
        ID: {
          type: "cds.UUID",
        },
        name: {
          type: "cds.String",
        },
      },
    },
  },
};
const edmx = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="1.0" xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" xmlns:sap="http://www.sap.com/Protocols/SAPData">
  <edmx:DataServices m:DataServiceVersion="2.0">
    <Schema Namespace="test.MainService" xmlns="http://schemas.microsoft.com/ado/2008/09/edm"/>
    <EntityContainer Name="EntityContainer">
      <EntitySet Name="Header" EntityType="test.MainService.Header">
      </EntitySet>
    </EntityContainer>
    <EntityType Name="Header">
    </EntityType>
  </edmx:DataServices>
</edmx:Edmx>`;

const authorization = `Basic ${Buffer.from(
  `${cds.requires.auth.users.alice.id}:${cds.requires.auth.users.alice.password}`,
).toString("base64")}`;

function clearCache() {
  return cds.emit("cds.xt.TENANT_UPDATED", {
    tenant: "t1",
  });
}

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

describe("mtxs", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app.server);
  });

  it("MTXS $metadata", async () => {
    cds.env.requires.multitenancy = true;
    cds.env.requires["cds.xt.ModelProviderService"] = true;
    const response = await util.callRead(request, "/odata/v2/main/$metadata", {
      accept: "application/xml",
      Authorization: authorization,
    });
    expect(response.body).toBeDefined();
    expect(response.text).toEqual(edmx);
    expect(cds.services["cds.xt.ModelProviderService"].getCsn).toHaveBeenCalled();
    expect(cds.services["cds.xt.ModelProviderService"].getEdmx).toHaveBeenCalled();
    expect(cds.services["cds.xt.ModelProviderService"].isExtended).toHaveBeenCalled();
  });

  it("MTXS event emitter", async () => {
    cds.env.requires.multitenancy = true;
    cds.env.requires["cds.xt.ModelProviderService"] = true;
    clearCache();
    await util.callRead(request, "/odata/v2/main/Header", {
      accept: "application/xml",
      Authorization: authorization,
    });
    let response = await util.callRead(request, "/odata/v2/main/$metadata", {
      accept: "application/xml",
      Authorization: authorization,
    });
    expect(response.body).toBeDefined();
    expect(response.text).toEqual(edmx);
    expect(cds.services["cds.xt.ModelProviderService"].getCsn).toHaveBeenCalled();
    expect(cds.services["cds.xt.ModelProviderService"].getEdmx).toHaveBeenCalled();
    expect(cds.services["cds.xt.ModelProviderService"].isExtended).toHaveBeenCalled();

    clearCache();
    cds.services["cds.xt.ModelProviderService"].getCsn.mockClear();
    cds.services["cds.xt.ModelProviderService"].getEdmx.mockClear();
    cds.services["cds.xt.ModelProviderService"].isExtended.mockClear();

    response = await util.callRead(request, "/odata/v2/main/$metadata", {
      accept: "application/xml",
      Authorization: authorization,
    });
    expect(response.body).toBeDefined();
    expect(response.text).toEqual(edmx);
    expect(cds.services["cds.xt.ModelProviderService"].getCsn).toHaveBeenCalled();
    expect(cds.services["cds.xt.ModelProviderService"].getEdmx).toHaveBeenCalled();
    expect(cds.services["cds.xt.ModelProviderService"].isExtended).toHaveBeenCalled();
  });
});
