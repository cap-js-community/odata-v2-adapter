"use strict";

const supertest = require("supertest");

const env = require("./_env");
const util = require("../test/_env/util");

let context;
let request;

describe("main-request", () => {
  beforeAll(async () => {
    context = await env("index");
    request = supertest(context.app);
  });

  afterAll(() => {
    env.end(context);
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

  it("GET with parameters (header - full circle)", async () => {
    const stock = 1;
    // Empty Parameters
    let response = await util.callRead(request, `/v2/main/HeaderParameters(STOCK=${stock},CURRENCY='XXX')`);
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toEqual([]);

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
    expect(clean(response.body)).toMatchSnapshot();

    // Single Entry
    response = await util.callRead(
      request,
      `/v2/main/HeaderParametersSet(STOCK=${stock},CURRENCY='EUR',ID=guid'${ID}')`
    );
    expect(response.body).toBeDefined();
    expect(clean(response.body)).toMatchSnapshot();

    // Entry Parameters
    response = await util.callRead(
      request,
      `/v2/main/HeaderParametersSet(STOCK=${stock},CURRENCY='EUR',ID=guid'${ID}')/Parameters`
    );
    expect(response.body).toBeDefined();
    expect(clean(response.body)).toMatchSnapshot();
  });

  it("GET with parameters (agreement pricing for key date - full circle)", async () => {
    // Empty Parameters
    let response = await util.callRead(
      request,
      `/v2/agreement/AgreementItemPricingForKeyDate(datetime'2002-06-20T00:00')`
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toEqual([]);

    // Empty Set
    response = await util.callRead(
      request,
      `/v2/agreement/AgreementItemPricingForKeyDate(keyDate=datetime'2000-06-20T00:00:00Z')/Set`
    );
    expect(response.body.d.results).toEqual([]);

    // Parameters
    response = await util.callRead(request, `/v2/agreement/AgreementItemPricingForKeyDate(datetime'2022-06-20T00:00')`);
    expect(response.body).toBeDefined();
    expect(clean(response.body)).toMatchSnapshot();

    // Result Set
    response = await util.callRead(
      request,
      `/v2/agreement/AgreementItemPricingForKeyDate(keyDate=datetime'2022-06-20T00:00:00Z')/Set`
    );
    expect(response.body).toBeDefined();
    expect(clean(response.body)).toMatchSnapshot();

    // Single Entry
    response = await util.callRead(
      request,
      `/v2/agreement/AgreementItemPricingForKeyDateSet(keyDate=datetime'2022-06-20T00:00',ID=guid'f8420eac-a36b-49af-b91c-6559b8f7627e')`
    );
    expect(response.body).toBeDefined();
    expect(clean(response.body)).toMatchSnapshot();

    // Entry Parameters
    response = await util.callRead(
      request,
      `/v2/agreement/AgreementItemPricingForKeyDateSet(keyDate=datetime'2022-06-20T00:00',ID=guid'f8420eac-a36b-49af-b91c-6559b8f7627e')/Parameters`
    );
    expect(response.body).toBeDefined();
    expect(clean(response.body)).toMatchSnapshot();
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
