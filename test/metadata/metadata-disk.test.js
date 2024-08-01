"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");

const util = require("../_env/util/request");

process.env.TEST_COV2AP_COMPRESSION = "false";

cds.test(__dirname + "/../_env");
cds.env.cov2ap.cacheMetadata = "disk";

let request;

describe("main", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app.server);
  });

  it("GET $metadata", async () => {
    const response = await util.callRead(request, "/odata/v2/main/$metadata", {
      accept: "application/xml",
    });
    expect(response.body).toBeDefined();
    expect(response.headers).toMatchObject({
      "x-request-id": expect.any(String),
      "x-correlation-id": expect.any(String),
      "x-correlationid": expect.any(String),
      connection: "keep-alive",
      "content-length": "88416",
      "content-type": "application/xml",
      date: expect.any(String),
      etag: expect.any(String),
      "keep-alive": expect.stringMatching(/timeout=.*/),
      dataserviceversion: "2.0",
    });
    expect(response.text).toMatchSnapshot();
  });
});
