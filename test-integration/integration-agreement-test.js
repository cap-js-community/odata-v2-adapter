"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");

const util = require("../test/_env/util/request");

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
      `/v2/agreement/AgreementItemPricingForKeyDate(datetime'2002-06-20T00:00:00')`
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toEqual([]);

    // Empty Set
    response = await util.callRead(
      request,
      `/v2/agreement/AgreementItemPricingForKeyDate(keyDate=datetime'2000-06-20T00:00:00')/Set`
    );
    expect(response.body.d.results).toEqual([]);

    // Parameters
    response = await util.callRead(
      request,
      `/v2/agreement/AgreementItemPricingForKeyDate(datetime'2022-06-20T00:00:00')`
    );
    expect(response.body).toBeDefined();
    expect(clean(response.body)).toMatchSnapshot();

    // Result Set
    response = await util.callRead(
      request,
      `/v2/agreement/AgreementItemPricingForKeyDate(keyDate=datetime'2022-06-20T00:00:00')/Set`
    );
    expect(response.body).toBeDefined();
    expect(clean(response.body)).toMatchSnapshot();

    // Single Entry
    response = await util.callRead(
      request,
      `/v2/agreement/AgreementItemPricingForKeyDateSet(keyDate=datetime'2022-06-20T00:00:00',ID=guid'f8420eac-a36b-49af-b91c-6559b8f7627e')`
    );
    expect(response.body).toBeDefined();
    expect(clean(response.body)).toMatchSnapshot();

    // Entry Parameters
    response = await util.callRead(
      request,
      `/v2/agreement/AgreementItemPricingForKeyDateSet(keyDate=datetime'2022-06-20T00:00:00',ID=guid'f8420eac-a36b-49af-b91c-6559b8f7627e')/Parameters`
    );
    expect(response.body).toBeDefined();
    expect(clean(response.body)).toMatchSnapshot();
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
