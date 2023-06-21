"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");

const util = require("../test/_env/util/request");

cds.test(__dirname + "/_env");

let request;

describe("integration-main", () => {
  beforeAll(() => {
    request = supertest(cds.app);
  });

  afterAll(async () => {
    await cds.disconnect();
    await cds.shutdown();
  });

  it("GET $metadata", async () => {
    const response = await util.callRead(request, "/v2/main/$metadata", {
      accept: "application/xml",
    });
    expect(response.body).toBeDefined();
    expect(response.text).toMatchSnapshot();
  });

  it("GET with parameters", async () => {
    const stock = Math.round(new Date().getTime() / 1000);
    await util.callWrite(request, "/v2/main/Header", {
      stock: stock,
      currency: "USD",
    });
    await util.callWrite(request, "/v2/main/Header", {
      stock: 1,
      currency: "EUR",
    });
    const response = await util.callRead(request, `/v2/main/HeaderParameters(STOCK=${stock},CURRENCY='USD')/Set`);
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(1);
    expect(response.body.d.results).toMatchObject([
      {
        __metadata: {
          type: "test.MainService.HeaderParametersType",
        },
        country: null,
        createdBy: "anonymous",
        currency: "USD",
        description: null,
        modifiedBy: "anonymous",
        name: null,
        price: null,
        stock,
        STOCK_PARAM: stock,
        CURRENCY_PARAM: "USD",
      },
    ]);
  });

  it("GET with parameters (header - full circle) - parameters", async () => {
    const stock = 1;
    // Empty Parameters
    let response = await util.callRead(request, `/v2/main/HeaderParameters(STOCK=${stock},CURRENCY='XXX')`);
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
    response = await util.callRead(request, `/v2/main/HeaderParameters(STOCK=${stock},CURRENCY='XXX')/Set`);
    expect(response.body.d.results).toEqual([]);

    // Parameters
    response = await util.callRead(request, `/v2/main/HeaderParameters(STOCK=${stock},CURRENCY='EUR')`);
    expect(response.body).toBeDefined();
    expect(clean(response.body)).toMatchSnapshot();

    // Result Set
    response = await util.callRead(request, `/v2/main/HeaderParameters(STOCK=${stock},CURRENCY='EUR')/Set`);
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toBeDefined();
    const ID = response.body.d.results[0].ID;
    expect(ID).toBeDefined();
    response.body.d.results = response.body.d.results.slice(0, 1);
    expect(clean(response.body, ID)).toMatchSnapshot();

    // Single Entry
    response = await util.callRead(
      request,
      `/v2/main/HeaderParametersSet(STOCK=${stock},CURRENCY='EUR',ID=guid'${ID}')`
    );
    expect(response.body).toBeDefined();
    expect(clean(response.body, ID)).toMatchSnapshot();

    // Entry Parameters
    response = await util.callRead(
      request,
      `/v2/main/HeaderParametersSet(STOCK=${stock},CURRENCY='EUR',ID=guid'${ID}')/Parameters`
    );
    expect(response.body).toBeDefined();
    expect(clean(response.body, ID)).toMatchSnapshot();
  });

  it("GET with parameters (header - full circle) - set", async () => {
    const stock = 1;
    // Empty Parameters
    let response = await util.callRead(request, `/v2/main/HeaderSet(STOCK=${stock},CURRENCY='XXX')`);
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
    response = await util.callRead(request, `/v2/main/HeaderSet(STOCK=${stock},CURRENCY='XXX')/Set`);
    expect(response.body.d.results).toEqual([]);

    // Parameters
    response = await util.callRead(request, `/v2/main/HeaderSet(STOCK=${stock},CURRENCY='EUR')`);
    expect(response.body).toBeDefined();
    expect(clean(response.body)).toMatchSnapshot();

    // Result Set
    response = await util.callRead(request, `/v2/main/HeaderSet(STOCK=${stock},CURRENCY='EUR')/Set`);
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toBeDefined();
    const ID = response.body.d.results[0].ID;
    expect(ID).toBeDefined();
    response.body.d.results = response.body.d.results.slice(0, 1);
    expect(clean(response.body, ID)).toMatchSnapshot();

    // Single Entry
    response = await util.callRead(request, `/v2/main/HeaderSetSet(STOCK=${stock},CURRENCY='EUR',ID=guid'${ID}')`);
    expect(response.body).toBeDefined();
    expect(clean(response.body, ID)).toMatchSnapshot();

    // Entry Parameters
    response = await util.callRead(
      request,
      `/v2/main/HeaderSetSet(STOCK=${stock},CURRENCY='EUR',ID=guid'${ID}')/Parameters`
    );
    expect(response.body).toBeDefined();
    expect(clean(response.body, ID)).toMatchSnapshot();
  });

  it("GET request with function 'substringof'", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test",
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    response = await util.callRead(request, `/v2/main/Header?$filter=ID eq guid'${id}' and substringof('es',name)`);
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(request, `/v2/main/Header?$filter=ID eq guid'${id}' and substringof('ES',name)`);
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(request, `/v2/main/Header?$filter=ID eq guid'${id}' and substringof('XX',name)`);
    expect(response.body.d.results).toHaveLength(0);
  });

  it("GET request with function 'startswith'", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test",
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    response = await util.callRead(request, `/v2/main/Header?$filter=ID eq guid'${id}' and startswith(name,'Te')`);
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(request, `/v2/main/Header?$filter=ID eq guid'${id}' and startswith(name,'TE')`);
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(request, `/v2/main/Header?$filter=ID eq guid'${id}' and startswith(name,'XX')`);
    expect(response.body.d.results).toHaveLength(0);
  });

  it("GET request with function 'endswith'", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test",
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    response = await util.callRead(request, `/v2/main/Header?$filter=ID eq guid'${id}' and endswith(name,'st')`);
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(request, `/v2/main/Header?$filter=ID eq guid'${id}' and endswith(name,'ST')`);
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(request, `/v2/main/Header?$filter=ID eq guid'${id}' and endswith(name,'XX')`);
    expect(response.body.d.results).toHaveLength(0);
  });

  it("GET request with next link responses", async () => {
    let response = await util.callWrite(request, "/v2/main/HeaderLimited", {
      name: "Test",
    });
    expect(response.statusCode).toEqual(201);
    response = await util.callRead(request, "/v2/main/HeaderLimited");
    expect(response.statusCode).toEqual(200);
    expect(response.body.d.results).toBeDefined();
    expect(response.body.d.__next).toMatch(/http:\/\/localhost:(\d*)\/v2\/main\/HeaderLimited\?\$skiptoken=1/);
    const nextUrl = response.body.d.__next.match(/http:\/\/localhost:\d*(.*)/)[1];
    response = await util.callRead(request, nextUrl);
    expect(response.body.d.results).toBeDefined();
    expect(response.body.d.results).toHaveLength(1);
    expect(response.body.d.__next).toMatch(/http:\/\/localhost:(\d*)\/v2\/main\/HeaderLimited\?\$skiptoken=2/);
  });
});

function clean(responseBody, ID) {
  function replaceUri(text) {
    return text
      .replace(/localhost:([0-9]*)/g, "localhost:00000")
      .replace(ID, "<ID>")
  }

  function replaceAll(entry) {
    delete entry.ID;
    delete entry.createdAt;
    delete entry.modifiedAt;
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
