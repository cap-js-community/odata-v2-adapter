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
          type: "test.MainService.HeaderParameters",
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

  it("GET with agreement pricing for key date", async () => {
    let response = await util.callRead(request, `/v2/agreement/AgreementItemPricingForKeyDate(keyDate=datetime'2022-06-20T00:00:00Z')/Set`);
    expect(response.body).toBeDefined();
    delete response.body.d.results[0].__metadata.uri;
    expect(response.body).toMatchSnapshot();
    response = await util.callRead(request, `/v2/agreement/AgreementItemPricingForKeyDate(keyDate=datetime'2000-06-20T00:00:00Z')/Set`);
    expect(response.body.d.results).toEqual([]);
  });
});
