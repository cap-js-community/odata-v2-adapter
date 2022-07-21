"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");

const util = require("../test/_env/util/request");
const fs = require("fs");

cds.test(__dirname + "/_env");

let request;

describe("integration-agreement", () => {
  beforeAll(() => {
    request = supertest(cds.app);
  });

  it("GET $metadata", async () => {
    const response = await util.callRead(request, "/v2/agreement/$metadata", {
      accept: "application/xml",
    });
    expect(response.body).toBeDefined();
    expect(response.text).toMatchSnapshot();
  });

  it("GET with parameters (agreement pricing for key date - full circle)", async () => {
    // Empty Parameters
    let response = await util.callRead(
      request,
      "/v2/agreement/AgreementItemPricingForKeyDate(datetime'2002-06-20T00:00:00')"
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toEqual([]);

    // Empty Set
    response = await util.callRead(
      request,
      "/v2/agreement/AgreementItemPricingForKeyDate(keyDate=datetime'2000-06-20T00:00:00')/Set"
    );
    expect(response.body.d.results).toEqual([]);

    // Parameters
    response = await util.callRead(
      request,
      "/v2/agreement/AgreementItemPricingForKeyDate(datetime'2022-06-20T00:00:00')"
    );
    expect(response.body).toBeDefined();
    expect(clean(response.body)).toMatchSnapshot();

    // Result Set
    response = await util.callRead(
      request,
      "/v2/agreement/AgreementItemPricingForKeyDate(keyDate=datetime'2022-06-20T00:00:00')/Set"
    );
    expect(response.body).toBeDefined();
    expect(clean(response.body)).toMatchSnapshot();

    // Single Entry
    response = await util.callRead(
      request,
      "/v2/agreement/AgreementItemPricingForKeyDateSet(keyDate=datetime'2022-06-20T00:00:00',ID=guid'f8420eac-a36b-49af-b91c-6559b8f7627e')"
    );
    expect(response.body).toBeDefined();
    expect(clean(response.body)).toMatchSnapshot();

    // Entry Parameters
    response = await util.callRead(
      request,
      "/v2/agreement/AgreementItemPricingForKeyDateSet(keyDate=datetime'2022-06-20T00:00:00',ID=guid'f8420eac-a36b-49af-b91c-6559b8f7627e')/Parameters"
    );
    expect(response.body).toBeDefined();
    expect(clean(response.body)).toMatchSnapshot();
  });

  it("GET with parameters and $count", async () => {
    const response = await util.callRead(
      request,
      "/v2/agreement/AgreementItemPricingForKeyDate(keyDate=datetime'2022-06-20T00:00:00')/Set/$count"
    );
    expect(response.text).toEqual("2");
  });

  it("GET with parameters and sort", async () => {
    const response = await util.callRead(
      request,
      "/v2/agreement/AgreementItemPricingForKeyDate(keyDate=datetime'2022-06-20T00:00:00')/Set?$skip=0&$top=20&$orderby=keyDate%20asc"
    );
    expect(response.body.d.results.length).toEqual(2);
  });

  it("GET with parameters in batch", async () => {
    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-GET-Parameters.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    let response = await util.callMultipart(request, "/v2/agreement/$batch", payload);
    expect(response.statusCode).toEqual(202);
    const responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(2);
    expect(responses.filter((response) => response.statusCode === 200).length).toEqual(2);
    const [first, second] = responses;
    expect(first.body).toEqual("2");
    expect(second.body.d.results.length).toEqual(2);
  });
});

function clean(responseBody) {
  function replacePort(text) {
    return text.replace(/localhost:([0-9]*)/g, "localhost:00000");
  }

  responseBody.d.results.forEach((entry) => {
    entry.__metadata.uri = replacePort(entry.__metadata.uri);
    if (entry.Set) {
      entry.Set.__deferred.uri = replacePort(entry.Set.__deferred.uri);
    }
    if (entry.Parameters) {
      entry.Parameters.__deferred.uri = replacePort(entry.Parameters.__deferred.uri);
    }
  });
  return responseBody;
}
