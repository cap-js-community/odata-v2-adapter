"use strict";

const supertest = require("supertest");
const fs = require("fs");

const env = require("./_env");
const util = require("./_env/util");
const init = require("./_env/data/init");

let context;
let request;

describe("main-request", () => {
  beforeAll(async () => {
    context = await env("model", 0, init);
    request = supertest(context.app);
  });

  afterAll(() => {
    env.end(context);
  });

  it("HEAD service", async () => {
    const response = await util.callHead(request, "/v2/main");
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({});
  });

  it("GET service JSON format", async () => {
    let response = await util.callRead(request, "/v2/main", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        EntitySets: ["Favorite", "Header", "HeaderAssocKey", "HeaderItem", "HeaderStream", "HeaderUrlStream", "StringUUID"],
      },
    });
    response = await util.callRead(request, "/v2/main/", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        EntitySets: ["Favorite", "Header", "HeaderAssocKey", "HeaderItem", "HeaderStream", "HeaderUrlStream", "StringUUID"],
      },
    });
  });

  it("GET service XML format", async () => {
    let response = await util.callRead(request, "/v2/main", {
      accept: "application/xml",
    });
    expect(response.text).toBeDefined();
    response.text = response.text.replace(/http:\/\/127.0.0.1:(\d*)\//, "");
    expect(response.text).toMatchSnapshot();
    response = await util.callRead(request, "/v2/main/", {
      accept: "application/xml",
    });
    expect(response.text).toBeDefined();
    response.text = response.text.replace(/http:\/\/127.0.0.1:(\d*)\//, "");
    expect(response.text).toMatchSnapshot();
    response = await util.callRead(request, "/v2/main");
    expect(response.text).toBeDefined();
    response.text = response.text.replace(/http:\/\/127.0.0.1:(\d*)\//, "");
    expect(response.text).toMatchSnapshot();
  });

  it("GET $metadata", async () => {
    const response = await util.callRead(request, "/v2/main/$metadata", {
      accept: "application/xml",
    });
    expect(response.body).toBeDefined();
    expect(response.text).toMatchSnapshot();
  });

  it("GET $metadata localized", async () => {
    let response = await util.callRead(request, "/v2/main/$metadata?sap-language=de", {
      accept: "application/xml",
    });
    expect(response.body).toBeDefined();
    expect(response.text).toMatchSnapshot();
    response = await util.callRead(request, "/v2/main/$metadata", {
      "accept-language": "de-DE",
    });
    expect(response.body).toBeDefined();
    expect(response.text).toMatchSnapshot();
  });

  it("GET request", async () => {
    let response = await util.callRead(request, "/v2/main/Header");
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(5);
    response = await util.callRead(request, "/v2/main/Header?$inlinecount=allpages");
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(5);
    expect(response.body.d.__count).toEqual("5");
    const id = response.body.d.results[0].ID;
    response = await util.callRead(request, `/v2/main/HeaderAssocKey(guid'${id}')`);
    expect(response.body).toBeDefined();
    expect(response.status).toEqual(404);
    expect(response.body.error).toEqual({
      code: "404",
      message: {
        lang: "en",
        value: "Not Found",
      },
      innererror: {
        errordetails: [
          {
            code: "404",
            message: {
              lang: "en",
              value: "Not Found",
            },
            severity: "error",
          },
        ],
      },
    });
  });

  it("GET request with $-options", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test",
      Items: [
        {
          name: "TestItem",
        },
      ],
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    response = await util.callRead(
      request,
      `/v2/main/Header?$filter=ID eq guid'${id}'&$select=ID,name&$expand=FirstItem,Items&$skip=0&$top=1&$orderby=name asc&createdAt=datetime'123456'`
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toMatchObject([
      {
        __metadata: {
          type: "test.MainService.Header",
          uri: `http://${response.request.host}/v2/main/Header(guid'${id}')`,
        },
        ID: id,
        FirstItem: null,
        Items: {
          results: [
            {
              __metadata: {
                type: "test.MainService.HeaderItem",
              },
              description: null,
              endAt: null,
              header: {
                __deferred: {},
              },
              header_ID: id,
              name: "TestItem",
              startAt: null,
            },
          ],
        },
        name: "Test",
      },
    ]);
  });

  it("GET request with deep $expand/$select", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test",
      Items: [
        {
          name: "TestItem",
        },
      ],
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    response = await util.callRead(
      request,
      `/v2/main/Header?$filter=ID eq guid'${id}'&$expand=Items,Items/header,Items/header/Items&$select=ID,name,Items/ID,Items/name,Items/header/ID,Items/header/name`
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results[0]).toMatchObject({
      __metadata: {
        uri: `http://${response.request.host}/v2/main/Header(guid'${id}')`,
        type: "test.MainService.Header",
      },
      ID: id,
      name: "Test",
      Items: {
        results: [
          {
            __metadata: {
              type: "test.MainService.HeaderItem",
            },
            name: "TestItem",
            header: {
              __metadata: {
                uri: `http://${response.request.host}/v2/main/Header(guid'${id}')`,
                type: "test.MainService.Header",
              },
              ID: id,
              name: "Test",
              Items: {
                results: [
                  {
                    __metadata: {
                      type: "test.MainService.HeaderItem",
                    },
                    name: "TestItem",
                    description: null,
                    startAt: null,
                    endAt: null,
                    header_ID: id,
                    header: {
                      __deferred: {},
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    });
    response = await util.callRead(
      request,
      `/v2/main/Header?$filter=ID eq guid'${id}'&$expand=Items&$select=Items/name`
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results[0]).toMatchObject({
      __metadata: {
        uri: `http://${response.request.host}/v2/main/Header(guid'${id}')`,
        type: "test.MainService.Header",
      },
      ID: id,
      createdBy: "anonymous",
      modifiedBy: "anonymous",
      name: "Test",
      description: null,
      country: null,
      currency: null,
      stock: null,
      price: null,
      FirstItem_ID: null,
      Items: {
        results: [
          {
            __metadata: {
              type: "test.MainService.HeaderItem",
            },
            name: "TestItem",
          },
        ],
      },
    });
  });

  it("GET request with search", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test",
    });
    expect(response.statusCode).toEqual(201);
    response = await util.callWrite(request, "/v2/main/Header", {
      name: "Search Instance_Test",
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    response = await util.callRead(request, `/v2/main/Header?search=Search%20Instance`);
    expect(response.body.d.results.length).toEqual(1);
  });

  it("GET request with $count", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test",
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    response = await util.callRead(request, `/v2/main/Header/$count?$filter=ID eq guid'${id}'`);
    expect(response.text).toEqual("1");
  });

  it("GET request with $value", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test",
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    response = await util.callRead(request, `/v2/main/Header(guid'${id}')/ID`);
    expect(response.body).toEqual({
      d: {
        ID: id,
      },
    });
    response = await util.callRead(request, `/v2/main/Header(guid'${id}')/ID/$value`);
    expect(response.headers["content-type"]).toEqual("text/plain");
    expect(response.text).toEqual(id);
  });

  it("GET request with stream", async () => {
    let response = await util.callRead(
      request,
      `/v2/main/HeaderStream(guid'f8a7a4f7-1901-4032-a237-3fba1d1b2343')/data`
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body.length).toBe(17686);
    expect(response.headers["transfer-encoding"]).toEqual("chunked");
    expect(response.headers["content-type"]).toEqual("image/png");
    expect(response.headers["content-disposition"]).toEqual('inline; filename="file.png"');
    response = await util.callRead(
      request,
      `/v2/main/HeaderStream(guid'f8a7a4f7-1901-4032-a237-3fba1d1b2343')/data/$value`
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body.length).toBe(17686);
    expect(response.headers["transfer-encoding"]).toEqual("chunked");
    expect(response.headers["content-type"]).toEqual("image/png");
    expect(response.headers["content-disposition"]).toEqual('inline; filename="file.png"');
    response = await util.callRead(request, `/v2/main/HeaderStream(guid'f8a7a4f7-1901-4032-a237-3fba1d1b2343')/$value`);
    expect(response.statusCode).toEqual(200);
    expect(response.body.length).toBe(17686);
    expect(response.headers["transfer-encoding"]).toEqual("chunked");
    expect(response.headers["content-type"]).toEqual("image/png");
    expect(response.headers["content-disposition"]).toEqual('inline; filename="file.png"');
  });

  it("GET request with url stream", async () => {
    let response = await util.callRead(
      request,
      `/v2/main/HeaderUrlStream(guid'f8a7a4f7-1901-4032-a237-3fba1d1b2343')/link`
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body.length).toBe(17686);
    expect(response.headers["transfer-encoding"]).toEqual("chunked");
    expect(response.headers["content-type"]).toEqual("image/png");
    expect(response.headers["content-disposition"]).toEqual('inline; filename="file.png"');
    response = await util.callRead(
      request,
      `/v2/main/HeaderUrlStream(guid'f8a7a4f7-1901-4032-a237-3fba1d1b2343')/link/$value`
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body.length).toBe(17686);
    expect(response.headers["transfer-encoding"]).toEqual("chunked");
    expect(response.headers["content-type"]).toEqual("image/png");
    expect(response.headers["content-disposition"]).toEqual('inline; filename="file.png"');
    response = await util.callRead(
      request,
      `/v2/main/HeaderUrlStream(guid'f8a7a4f7-1901-4032-a237-3fba1d1b2343')/$value`
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body.length).toBe(17686);
    expect(response.headers["transfer-encoding"]).toEqual("chunked");
    expect(response.headers["content-type"]).toEqual("image/png");
    expect(response.headers["content-disposition"]).toEqual('inline; filename="file.png"');
    response = await util.callRead(
      request,
      `/v2/main/HeaderUrlStream(guid'e8a7a4f7-1901-4032-a237-3fba1d1b2343')/$value`
    );
    expect(response.statusCode).toEqual(500);
    expect(response.body).toEqual({
      error: {
        code: "ECONNREFUSED",
        errno: "ECONNREFUSED",
        innererror: {
          errordetails: [
            {
              code: "ECONNREFUSED",
              errno: "ECONNREFUSED",
              message: {
                lang: "en",
                value:
                  "request to http://localhost:8888/v2/main/HeaderStream(guid%27f8a7a4f7-1901-4032-a237-3fba1d1b2343%27)/$value failed, reason: connect ECONNREFUSED 127.0.0.1:8888",
              },
              severity: "error",
              type: "system",
            },
          ],
        },
        message: {
          lang: "en",
          value:
            "request to http://localhost:8888/v2/main/HeaderStream(guid%27f8a7a4f7-1901-4032-a237-3fba1d1b2343%27)/$value failed, reason: connect ECONNREFUSED 127.0.0.1:8888",
        },
        type: "system",
      },
    });
    response = await util.callRead(
      request,
      `/v2/main/HeaderUrlStream(guid'a8a7a4f7-1901-4032-a237-3fba1d1b2343')/$value`
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual({
      error: {
        code: "null",
        message: {
          lang: "en",
          value: "Expected uri token 'EOF' could not be found in '$value2' at position 7",
        },
        innererror: {
          errordetails: [
            {
              code: "null",
              message: {
                lang: "en",
                value: "Expected uri token 'EOF' could not be found in '$value2' at position 7",
              },
              severity: "error",
            },
          ],
        },
      },
    });
  });

  it("PUT request with stream", () => {
    return new Promise((done) => {
      util
        .callWrite(request, "/v2/main/HeaderStream", {
          mediaType: "image/png",
          filename: "test.png",
        })
        .then((createResponse) => {
          expect(createResponse.statusCode).toEqual(201);
          const id = createResponse.body.d.ID;

          const stream = fs.createReadStream("./test/_env/data/init/assets/file.png");
          const req = util.callStream(request, `/v2/main/HeaderStream(guid'${id}')/data`, {
            "content-type": "image/png",
          });
          stream.on("end", () => {
            req.end(() => {
            });
            setTimeout(() => {
              util.callRead(request, `/v2/main/HeaderStream(guid'${id}')/data`).then((readResponse) => {
                expect(readResponse.statusCode).toEqual(200);
                expect(readResponse.headers["content-type"]).toEqual("image/png");
                expect(readResponse.body.length).toEqual(35372);
                return util.callDelete(request, `/v2/main/HeaderStream(guid'${id}')/data`).then((deleteResponse) => {
                  expect(deleteResponse.statusCode).toEqual(204);
                  return util.callRead(request, `/v2/main/HeaderStream(guid'${id}')/data`).then((readResponse) => {
                    expect(readResponse.statusCode).toEqual(204);
                    done();
                  });
                });
              });
            }, 1000);
          });
          stream.pipe(req, { end: false });
        });
    });
  });

  it("GET request with function 'substringof'", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test",
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    response = await util.callRead(request, `/v2/main/Header?$filter=ID eq guid'${id}' and substringof('es',name)`);
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(
      request,
      `/v2/main/Header?$filter=ID eq guid'${id}' and substringof('es',tolower(name))`
    );
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(
      request,
      `/v2/main/Header?$filter=ID eq guid'${id}' and substringof('es',tolower(name)) or name eq 'ABC'`
    );
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(
      request,
      `/v2/main/Header?$filter=ID eq guid'${id}' and substringof('es',tolower(name))%20or%20name%20eq 'ABC'`
    );
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(
      request,
      `/v2/main/Header?$filter=ID eq guid'${id}' and substringof('es',tolower(name)) or substringof(')es , ''''and (t) substringof(''es'',tolower(name))',tolower(name))`
    );
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(
      request,
      `/v2/main/Header?$filter=(ID eq guid'${id}' and (substringof('es',tolower(name)) or (substringof(')es , ''''and (t) substringof(''es'',tolower(name))',tolower(name)))))`
    );
    expect(response.body.d.results).toHaveLength(1);
  });

  it('GET request with many "or" filters on same field', async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test",
      country: "US",
    });
    expect(response.statusCode).toEqual(201);
    response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test",
      country: "DE",
    });
    expect(response.statusCode).toEqual(201);
    response = await util.callRead(request, `/v2/main/Header?$filter=country eq 'X' or country eq 'A'`);
    expect(response.body.d.results).toHaveLength(0);
  });

  it("GET request with filter and data type conversion", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test",
      stock: 999,
      country: "US",
    });
    response = await util.callRead(request, `/v2/main/Header?$filter=stock eq 999`);
    expect(response.body.d.results).toHaveLength(1);
  });

  it("GET request with filter and data type conversion on navigation fields", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test",
      stock: 1001,
      country: "US",
      Items: [
        {
          name: "TestItem1001",
          startAt: "/Date(1586815200000)/",
        },
      ],
    });
    response = await util.callRead(request, `/v2/main/Header?$expand=Items&$filter=stock eq 1001`);
    expect(response.body.d.results).toHaveLength(1);
    const ID = response.body.d.results[0].ID;
    expect(response.body.d.results[0].Items.results).toHaveLength(1);
    const itemID = response.body.d.results[0].Items.results[0].ID;
    response = await util.callWrite(
      request,
      `/v2/main/Header(${ID})`,
      {
        ID,
        FirstItem_ID: itemID,
      },
      true
    );
    expect(response.statusCode).toBe(200);
    response = await util.callRead(
      request,
      `/v2/main/Header?$expand=FirstItem&$filter=stock eq 1001 and FirstItem/assoc/num eq 12.01d`
    );
    // TODO: cap/issues/4468
    // expect(response.body.d.results).toHaveLength(1);
    expect(response.body).toEqual({
      error: {
        code: "500",
        message: { lang: "en", value: 'SQLITE_ERROR: near ".": syntax error' },
        innererror: {
          errordetails: [
            {
              code: "500",
              message: { lang: "en", value: 'SQLITE_ERROR: near ".": syntax error' },
              severity: "error",
            },
          ],
        },
      },
    });
    response = await util.callRead(
      request,
      `/v2/main/Header?$expand=FirstItem&$filter=stock eq 1001 and FirstItem/startAt eq datetimeoffset'2020-04-14T00:00:00Z'`
    );
    // TODO: cap/issues/4468
    // expect(response.body.d.results).toHaveLength(1);
    expect(response.body).toEqual({
      error: {
        code: "500",
        innererror: {
          errordetails: [
            {
              code: "500",
              message: {
                lang: "en",
                value: "SQLITE_ERROR: no such column: a.FirstItem.startAt",
              },
              severity: "error",
            },
          ],
        },
        message: {
          lang: "en",
          value: "SQLITE_ERROR: no such column: a.FirstItem.startAt",
        },
      },
    });
    response = await util.callRead(
      request,
      `/v2/main/Header?$expand=FirstItem&$filter=FirstItem/name eq 'TestItem1001'`
    );
    // TODO: cap/issues/4468
    // expect(response.body.d.results).toHaveLength(1);
    expect(response.body).toEqual({
      error: {
        code: "500",
        innererror: {
          errordetails: [
            {
              code: "500",
              message: {
                lang: "en",
                value: "SQLITE_ERROR: no such column: a.FirstItem.name",
              },
              severity: "error",
            },
          ],
        },
        message: {
          lang: "en",
          value: "SQLITE_ERROR: no such column: a.FirstItem.name",
        },
      },
    });
  });

  it("GET request with uri escape character", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test %22",
      country: "US",
    });
    expect(response.statusCode).toEqual(201);
    const ID = response.body.d.ID;
    response = await util.callRead(request, `/v2/main/Header(guid'${ID}')`);
    expect(response.body.d).toMatchObject({
      ID,
      name: "Test %22",
      country: "US",
    });
    response = await util.callRead(request, encodeURI(`/v2/main/Header?$filter=name eq 'Test %22'`));
    expect(response.body.d.results).toHaveLength(1);
  });

  it("POST request", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test Create",
      Items: [
        {
          name: "Test Create Item",
        },
      ],
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    const id = response.body.d.ID;
    expect(id).toBeDefined();
    let itemId = response.body.d.Items.results[0].ID;
    expect(itemId).toBeDefined();
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          uri: `http://${response.request.host}/v2/main/Header(guid'${id}')`,
          type: "test.MainService.Header",
        },
        ID: id,
        createdBy: "anonymous",
        modifiedBy: "anonymous",
        name: "Test Create",
        description: null,
        Items: {
          results: [
            {
              __metadata: {
                type: "test.MainService.HeaderItem",
              },
              description: null,
              endAt: null,
              header_ID: id,
              name: "Test Create Item",
              startAt: null,
            },
          ],
        },
      },
    });
    expect(/\/Date\(.+?\)\//.test(response.body.d.createdAt)).toEqual(true);
    const createdAt = new Date(parseInt(response.body.d.createdAt.substring(6, response.body.d.createdAt.length - 2)));
    expect(createdAt.toString()).not.toEqual("Invalid Date");
    response = await util.callRead(request, "/v2/main/Header?$filter=name eq 'Test Create'");
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(request, `/v2/main/Header(guid'${id}')`);
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          uri: `http://${response.request.host}/v2/main/Header(guid'${id}')`,
          type: "test.MainService.Header",
        },
        createdBy: "anonymous",
        modifiedBy: "anonymous",
        name: "Test Create",
        description: null,
        Items: {
          __deferred: {
            uri: `http://${response.request.host}/v2/main/Header(guid'${id}')/Items`,
          },
        },
      },
    });
    response = await util.callRead(request, `/v2/main/Header(guid'${id}')/Items`);
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callWrite(request, `/v2/main/Header(guid'${id}')/Items`, {
      name: "Test Update",
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    itemId = response.body.d.ID;
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          uri: `http://${response.request.host}/v2/main/HeaderItem(guid'${itemId}')`,
          type: "test.MainService.HeaderItem",
        },
        name: "Test Update",
        description: null,
        startAt: null,
        endAt: null,
        header_ID: id,
        header: {
          __deferred: {
            uri: `http://${response.request.host}/v2/main/HeaderItem(guid'${itemId}')/header`,
          },
        },
      },
    });
    response = await util.callRead(request, `/v2/main/Header(guid'${id}')/Items(guid'${itemId}')`);
    expect(response.body).toBeDefined();
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          uri: `http://${response.request.host}/v2/main/HeaderItem(guid'${itemId}')`,
          type: "test.MainService.HeaderItem",
        },
        name: "Test Update",
        description: null,
        startAt: null,
        endAt: null,
        header_ID: id,
        header: {
          __deferred: {
            uri: `http://${response.request.host}/v2/main/HeaderItem(guid'${itemId}')/header`,
          },
        },
      },
    });
  });

  it("PUT request", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test",
    });
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callWrite(
      request,
      `/v2/main/Header(guid'${id}')`,
      {
        name: "Test2",
      },
      true
    );
    expect(response.statusCode).toEqual(200);
    response = await util.callRead(request, `/v2/main/Header(guid'${id}')`);
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          uri: `http://${response.request.host}/v2/main/Header(guid'${id}')`,
          type: "test.MainService.Header",
        },
        createdBy: "anonymous",
        modifiedBy: "anonymous",
        name: "Test2",
        description: null,
        Items: {
          __deferred: {
            uri: `http://${response.request.host}/v2/main/Header(guid'${id}')/Items`,
          },
        },
      },
    });
    response = await util.callWrite(
      request,
      "/v2/main/Header",
      {
        name: "Test",
      },
      true
    );
    expect(response.body).toMatchObject({
      error: {
        code: "null",
        message: {
          lang: "en",
          value: "Method PATCH not allowed for ENTITY.COLLECTION",
        },
      },
    });
  });

  it("PUT request after GET", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test",
    });
    expect(response.body).toBeDefined();
    let body = response.body;
    const id = body.d.ID;
    response = await util.callRead(request, `/v2/main/Header(guid'${id}')`);
    body = response.body;
    body.d.name = "Test2";
    response = await util.callWrite(request, `/v2/main/Header(guid'${id}')`, body.d, true);
    expect(response.statusCode).toEqual(200);
    response = await util.callRead(request, `/v2/main/Header(guid'${id}')`);
    expect(response.body.d.name).toEqual("Test2");
    response = await util.callRead(request, `/v2/main/Header(guid'${id}')?$expand=Items,FirstItem`);
    body = response.body;
    body.d.name = "Test3";
    response = await util.callWrite(request, `/v2/main/Header(guid'${id}')`, body.d, true);
    expect(response.statusCode).toEqual(200);
    response = await util.callRead(request, `/v2/main/Header(guid'${id}')`);
    expect(response.body.d.name).toEqual("Test3");
  });

  it("DELETE request", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test",
    });
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callDelete(request, `/v2/main/Header(guid'${id}')`);
    expect(response.statusCode).toEqual(204);
    response = await util.callRead(request, `/v2/main/Header(guid'${id}')`);
    expect(response.statusCode).toEqual(404);
    response = await util.callDelete(request, `/v2/main/Header(guid'${id}')`);
    expect(response.statusCode).toEqual(404);
    expect(response.body).toMatchObject({
      error: {
        code: "404",
        message: {
          lang: "en",
          value: "Not Found",
        },
      },
    });
  });

  it("GET unbound function request", async () => {
    let response = await util.callRead(request, `/v2/main/unboundFunction?num=1&text=abc`);
    expect(response.body).toMatchObject({
      d: {
        age: 1,
        code: "TEST",
        name: "abc",
      },
    });
    response = await util.callRead(request, `/v2/main/unboundFunction?num=1&text=a%20b%2Fc`);
    expect(response.body).toMatchObject({
      d: {
        age: 1,
        code: "TEST",
        name: "a b/c",
      },
    });
    response = await util.callRead(request, `/v2/main/unboundFunction?num=1&text=%27a%20b%2Fc%27`);
    expect(response.body).toMatchObject({
      d: {
        age: 1,
        code: "TEST",
        name: "a b/c",
      },
    });
    response = await util.callRead(request, `/v2/main/unboundFunction?num=1&text='abc'`);
    expect(response.body).toMatchObject({
      d: {
        age: 1,
        code: "TEST",
        name: "abc",
      },
    });

    const _request = util.callRead(request, `/v2/main/unboundFunction?num=1&text=abc`);
    // Set wrong body for GET
    _request.set("content-type", "application/json").send({ code: "TEST" });
    response = await _request;
    expect(response.body).toMatchObject({
      d: {
        age: 1,
        code: "TEST",
        name: "abc",
      },
    });
    response = await util.callRead(request, `/v2/main/unboundDecimalFunction`);
    expect(response.body).toMatchObject({
      d: {
        value: "12345.6789",
      },
    });
    response = await util.callRead(request, `/v2/main/unboundDecimalsFunction`);
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            value: "12345.6789",
          },
          {
            value: "12345.6789",
          },
        ],
      },
    });
  });

  it("GET unbound function error request", async () => {
    let response = await util.callRead(request, `/v2/main/unboundErrorFunction`);
    expect(response.body).toMatchObject({
      error: {
        code: "ERR01",
        message: {
          lang: "en",
          value: "An error occurred",
        },
        target: "Items",
        severity: "error",
        innererror: {
          errordetails: [
            {
              code: "ERR02-transition",
              message: "Error details",
              target: "Items",
              severity: "error",
              transition: true,
            },
          ],
        },
      },
    });
  });

  it("GET unbound function warning request", async () => {
    let response = await util.callRead(request, `/v2/main/unboundWarningFunction`);
    expect(response.body).toMatchObject({
      d: {
        age: 1,
        code: "TEST",
        name: "Test",
      },
    });
    expect(JSON.parse(response.headers["sap-message"])).toEqual({
      code: "WARN01",
      details: [
        {
          code: "WARN02",
          message: "Another Warning occurred",
          severity: "warning",
          target: "Root",
        },
      ],
      message: "An Warning occurred",
      severity: "warning",
      target: "Items",
    });
  });

  it("GET unbound function with navigation", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test",
      Items: [
        {
          name: "TestItem",
        },
      ],
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    response = await util.callRead(request, `/v2/main/unboundNavigationFunction?num=1&text=${id}`);
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          type: "test.MainService.Header",
          uri: `http://${response.request.host}/v2/main/Header(guid'${id}')`,
        },
        createdBy: "anonymous",
        modifiedBy: "anonymous",
        name: "Test",
        description: null,
      },
    });
    response = await util.callRead(request, `/v2/main/unboundNavigationsFunction?num=1&text=abc`);
    expect(response.body.d.results.length > 0).toEqual(true);
    response = await util.callRead(request, `/v2/main/unboundNavigationFunction/Items?num=1&text=abc`);
    expect(response.body).toMatchObject({
      error: {
        code: "null",
        message: {
          lang: "en",
          value: `Current function 'unboundNavigationFunction' is not composable; trailing segment 'Items' ist not allowed`,
        },
      },
    });
  });

  it("GET bound function request", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test",
    });
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callRead(request, `/v2/main/Header_boundFunction?ID=guid'${id}'&num=1&text=abc`);
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            age: 1,
            code: "TEST",
            name: "abc",
          },
        ],
      },
    });
    response = await util.callRead(request, `/v2/main/Header_boundFunction?ID=guid'${id}'&num=1&text=a%20b%2Fc`);
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            age: 1,
            code: "TEST",
            name: "a b/c",
          },
        ],
      },
    });
  });

  it("POST unbound action request", async () => {
    let response = await util.callWrite(request, `/v2/main/unboundAction?num=1&text=abc`);
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            age: 1,
            code: "TEST",
            name: "abc",
          },
        ],
      },
    });
    response = await util.callWrite(request, `/v2/main/unboundAction?num=1&text=a%20b%2Fc`);
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            age: 1,
            code: "TEST",
            name: "a b/c",
          },
        ],
      },
    });
    response = await util.callWrite(request, `/v2/main/unboundAction`, {
      num: 1,
      text: "abc",
    });
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            age: 1,
            code: "TEST",
            name: "abc",
          },
        ],
      },
    });
    response = await util.callWrite(request, `/v2/main/unboundAction?num=1`, {
      text: "abc",
    });
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            age: 1,
            code: "TEST",
            name: "abc",
          },
        ],
      },
    });
  });

  it("POST bound action request", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test",
    });
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callWrite(request, `/v2/main/Header_boundAction?ID=guid'${id}'&num=1&text=abc`);
    expect(response.body).toMatchObject({
      d: {
        age: 1,
        code: "TEST",
        name: "abc",
      },
    });
    response = await util.callWrite(request, `/v2/main/Header_boundAction?ID=guid'${id}'&num=1&text=a%20b%2Fc`);
    expect(response.body).toMatchObject({
      d: {
        age: 1,
        code: "TEST",
        name: "a b/c",
      },
    });
  });

  it("GET HANA SYSUUID as ID", async () => {
    const ID = "D99B1B70-3B03-BC1E-1700-05023630F1F7";
    let response = await util.callWrite(request, "/v2/main/Header", {
      ID,
    });
    expect(response.statusCode).toEqual(201);
    response = await util.callRead(request, `/v2/main/Header(guid'${ID}')`);
    expect(response.body && response.body.d).toBeDefined();
    expect(response.body.d).toEqual(
      expect.objectContaining({
        ID,
      })
    );
  });

  it("Entity with key including reserved/escaped uri characters", async () => {
    let response = await util.callRead(request, "/v2/main/Favorite");
    expect(response.statusCode).toEqual(200);
    expect(response.body && response.body.d && response.body.d.results).toBeDefined();
    response.body.d.results.forEach((result) => {
      result.__metadata.uri = result.__metadata.uri.substr(`http://${response.request.host}`.length);
    });
    expect(response.body && response.body.d).toMatchSnapshot();

    const uris = response.body.d.results.map((result) => {
      return result.__metadata.uri.substr();
    });

    await uris.reduce(async (promise, uri) => {
      await promise;

      response = await util.callRead(request, uri);
      expect(response.statusCode).toEqual(200);
      expect(response.body && response.body.d).toBeDefined();
      let data = response.body && response.body.d;
      data.__metadata.uri = data.__metadata.uri.substr(`http://${response.request.host}`.length);
      const id = data.__metadata.uri.substring(
        data.__metadata.uri.indexOf("'") + 1,
        data.__metadata.uri.lastIndexOf("'")
      );
      let name = decodeURIComponent(id);
      name = name.replace(/''/g, "'");
      let value = name.substr(2, 1);
      // Special handling
      value = value === " " ? null : value;
      value = value === "\\" ? "\\\\" : value;
      expect(data).toEqual({
        __metadata: {
          type: "test.MainService.Favorite",
          uri: uri,
        },
        name,
        value,
      });

      response = await util.callRead(request, `/v2/main/Favorite?$filter=name eq '${id}'`);
      expect(response.statusCode).toEqual(200);
      data = response.body && response.body.d && response.body.d.results && response.body.d.results[0];
      data.__metadata.uri = data.__metadata.uri.substr(`http://${response.request.host}`.length);
      expect(data).toEqual({
        __metadata: {
          type: "test.MainService.Favorite",
          uri: uri,
        },
        name,
        value,
      });
    }, Promise.resolve());
  });

  it("Entity with string uuid key", async () => {
    let response = await util.callRead(request, "/v2/main/StringUUID");
    expect(response.statusCode).toEqual(200);
    expect(response.body && response.body.d && response.body.d.results).toBeDefined();
    response.body.d.results.forEach((result) => {
      result.__metadata.uri = result.__metadata.uri.substr(`http://${response.request.host}`.length);
    });
    expect(response.body && response.body.d).toMatchSnapshot();

    const uris = response.body.d.results.map((result) => {
      return result.__metadata.uri.substr();
    });

    await uris.reduce(async (promise, uri) => {
      await promise;

      response = await util.callRead(request, uri);
      expect(response.statusCode).toEqual(200);
      expect(response.body && response.body.d).toBeDefined();
    });
  });
});
