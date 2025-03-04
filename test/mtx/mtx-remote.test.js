"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");

global.fetch = jest.fn();

const util = require("../_env/util/request");

cds.test(__dirname + "/../_env");

cds.env.cov2ap.mtxRemote = true;

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
  `${cds.requires.auth.users.alice.id}:${cds.requires.auth.users.alice.password}`,
).toString("base64")}`;

describe("mtx", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app.server);
  });

  it("MTX $metadata (remote)", async () => {
    cds.env.requires.auth.users.alice.tenant = "t1";
    fetch.mockImplementation((url) => {
      if (url.endsWith("/main/") || url.includes("/metadata/edmx")) {
        return {
          status: 200,
          ok: true,
          text: () => {
            return edmx;
          },
          headers: new Map(),
        };
      }
      return {
        status: 200,
        ok: true,
        json: () => {
          return csn;
        },
        headers: new Map(),
      };
    });
    const response = await util.callRead(request, "/odata/v2/main/$metadata", {
      accept: "application/xml",
      Authorization: authorization,
    });
    expect(response.body).toBeDefined();
    expect(response.text).toEqual(edmx);
  });
});
