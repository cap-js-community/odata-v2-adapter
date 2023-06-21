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

  afterAll(async () => {
    await cds.disconnect();
    await cds.shutdown();
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
    expect(response.statusCode).toEqual(404);
    expect(response.body).toBeDefined();
    expect(response.body.error).toEqual({
      code: "404",
      innererror: {
        errordetails: [
          {
            code: "404",
            message: {
              lang: "en",
              value: "Not Found",
            },
            severity: "error",
            target: "/#TRANSIENT#",
          },
        ],
      },
      message: {
        lang: "en",
        value: "Not Found",
      },
      severity: "error",
      target: "/#TRANSIENT#",
    });

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
    expect(responses.length).toEqual(3);
    const [first, second, third] = responses;
    expect(first.statusCode).toEqual(200);
    expect(first.body).toEqual("2");
    expect(second.statusCode).toEqual(200);
    expect(second.body.d.results.length).toEqual(2);
    expect(third.statusCode).toEqual(404);
    expect(third.statusText).toEqual("Not Found");
    expect(third.body.error).toEqual({
      code: "404",
      innererror: {
        errordetails: [
          {
            code: "404",
            message: {
              lang: "en",
              value: "Not Found",
            },
            severity: "error",
            target: "/#TRANSIENT#",
          },
        ],
      },
      message: {
        lang: "en",
        value: "Not Found",
      },
      severity: "error",
      target: "/#TRANSIENT#",
    });
  });
});

function clean(responseBody) {
  function replaceUri(text) {
    return text.replace(/localhost:([0-9]*)/g, "localhost:00000");
  }

  function replaceAll(entry) {
    if (entry.__next) {
      entry.__next = replaceUri(entry.__next);
    }
    if (entry.__metadata) {
      entry.__metadata.uri = replaceUri(entry.__metadata.uri);
    }
    if (entry.Set) {
      entry.Set.__deferred.uri = replaceUri(entry.Set.__deferred.uri);
    }
    if (entry.Parameters) {
      entry.Parameters.__deferred.uri = replaceUri(entry.Parameters.__deferred.uri);
    }
  }

  replaceAll(responseBody.d);
  if (responseBody.d.results) {
    responseBody.d.results.forEach((entry) => {
      replaceAll(entry);
    });
  }

  return responseBody;
}
