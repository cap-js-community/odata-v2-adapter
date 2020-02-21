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

  it("GET service", async () => {
    let response = await util.callRead(request, "/v2/main", {
      accept: "application/json"
    });
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        EntitySets: ["Header", "HeaderAssocKey", "HeaderItem", "HeaderStream"]
      }
    });
    response = await util.callRead(request, "/v2/main/", {
      accept: "application/json"
    });
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        EntitySets: ["Header", "HeaderAssocKey", "HeaderItem", "HeaderStream"]
      }
    });
  });

  it("GET $metadata", async () => {
    const response = await util.callRead(request, "/v2/main/$metadata", {
      accept: "application/xml"
    });
    expect(response.body).toBeDefined();
    expect(response.text).toMatchSnapshot();
  });

  it("GET $metadata localized", async () => {
    let response = await util.callRead(request, "/v2/main/$metadata?sap-language=de", {
      accept: "application/xml"
    });
    expect(response.body).toBeDefined();
    expect(response.text).toMatchSnapshot();
    response = await util.callRead(request, "/v2/main/$metadata", {
      "accept-language": "de-DE"
    });
    expect(response.body).toBeDefined();
    expect(response.text).toMatchSnapshot();
  });

  it("GET request", async () => {
    let response = await util.callRead(request, "/v2/main/Header");
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(4);
    response = await util.callRead(request, "/v2/main/Header?$inlinecount=allpages");
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(4);
    expect(response.body.d.__count).toEqual("4");
    const id = response.body.d.results[0].ID;
    response = await util.callRead(request, `/v2/main/HeaderAssocKey(guid'${id}')`);
    expect(response.body).toBeDefined();
    expect(response.status).toEqual(404);
    expect(response.body.error).toEqual({
      code: "404",
      message: {
        lang: "en",
        value: "Not Found"
      },
      innererror: {
        errordetails: []
      }
    });
  });

  it("GET request with $-options", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test",
      Items: [
        {
          name: "TestItem"
        }
      ]
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
          uri: `http://${response.request.host}/v2/main/Header(guid'${id}')`
        },
        ID: id,
        FirstItem: null,
        Items: {
          results: [
            {
              __metadata: {
                type: "test.MainService.HeaderItem"
              },
              description: null,
              endAt: null,
              header: {
                __deferred: {}
              },
              header_ID: id,
              name: "TestItem",
              startAt: null
            }
          ]
        },
        name: "Test"
      }
    ]);
  });

  it("GET request with deep $expand/$select", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test",
      Items: [
        {
          name: "TestItem"
        }
      ]
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
        type: "test.MainService.Header"
      },
      ID: id,
      name: "Test",
      Items: {
        results: [
          {
            __metadata: {
              type: "test.MainService.HeaderItem"
            },
            name: "TestItem",
            header: {
              __metadata: {
                uri: `http://${response.request.host}/v2/main/Header(guid'${id}')`,
                type: "test.MainService.Header"
              },
              ID: id,
              name: "Test",
              Items: {
                results: [
                  {
                    __metadata: {
                      type: "test.MainService.HeaderItem"
                    },
                    name: "TestItem",
                    description: null,
                    startAt: null,
                    endAt: null,
                    header_ID: id,
                    header: {
                      __deferred: {}
                    }
                  }
                ]
              }
            }
          }
        ]
      }
    });
    response = await util.callRead(
      request,
      `/v2/main/Header?$filter=ID eq guid'${id}'&$expand=Items&$select=Items/name`
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results[0]).toMatchObject({
      __metadata: {
        uri: `http://${response.request.host}/v2/main/Header(guid'${id}')`,
        type: "test.MainService.Header"
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
              type: "test.MainService.HeaderItem"
            },
            name: "TestItem"
          }
        ]
      }
    });
  });

  it("GET request with search", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test"
    });
    expect(response.statusCode).toEqual(201);
    response = await util.callWrite(request, "/v2/main/Header", {
      name: "Search Instance_Test"
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    response = await util.callRead(request, `/v2/main/Header?search=Search%20Instance`);
    expect(response.body.d.results.length).toEqual(1);
  });

  it("GET request with $count", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test"
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    response = await util.callRead(request, `/v2/main/Header/$count?$filter=ID eq guid'${id}'`);
    expect(response.text).toEqual("1");
  });

  it("GET request with $value", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test"
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    response = await util.callRead(request, `/v2/main/Header(guid'${id}')/ID`);
    expect(response.body).toEqual({
      d: {
        ID: id
      }
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

  it("PUT request with stream", done => {
    util
      .callWrite(request, "/v2/main/HeaderStream", {
        mediaType: "image/png",
        filename: "test.png"
      })
      .then(createResponse => {
        expect(createResponse.statusCode).toEqual(201);
        const id = createResponse.body.d.ID;

        const stream = fs.createReadStream("./test/_env/data/init/assets/file.png");
        const req = util.callStream(request, `/v2/main/HeaderStream(guid'${id}')/data`, {
          "content-type": "image/png"
        });
        stream.on("end", () => {
          req.end(() => {});
          setTimeout(() => {
            util.callRead(request, `/v2/main/HeaderStream(guid'${id}')/data`).then(readResponse => {
              expect(readResponse.statusCode).toEqual(200);
              expect(readResponse.headers["content-type"]).toEqual("image/png");
              expect(readResponse.body.length).toEqual(35372);
              return util.callDelete(request, `/v2/main/HeaderStream(guid'${id}')/data`).then(deleteResponse => {
                expect(deleteResponse.statusCode).toEqual(204);
                return util.callRead(request, `/v2/main/HeaderStream(guid'${id}')/data`).then(readResponse => {
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

  it("GET request with function 'substringof'", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test"
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
      country: "US"
    });
    expect(response.statusCode).toEqual(201);
    response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test",
      country: "DE"
    });
    expect(response.statusCode).toEqual(201);
    response = await util.callRead(request, `/v2/main/Header?$filter=country eq 'X' or country eq 'A'`);
    expect(response.body.d.results).toHaveLength(0);
  });

  it("GET request with filter and data type conversion", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test",
      stock: 999,
      country: "US"
    });
    response = await util.callRead(request, `/v2/main/Header?$filter=stock eq 999L`);
    expect(response.body.d.results).toHaveLength(1);
  });

  it("GET request with uri escape character", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test %22",
      country: "US"
    });
    expect(response.statusCode).toEqual(201);
    const ID = response.body.d.ID;
    response = await util.callRead(request, `/v2/main/Header(guid'${ID}')`);
    expect(response.body.d).toMatchObject({
      ID,
      name: "Test %22",
      country: "US"
    });
    response = await util.callRead(request, encodeURI(`/v2/main/Header?$filter=name eq 'Test %22'`));
    expect(response.body.d.results).toHaveLength(1);
  });

  it("POST request", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test Create",
      Items: [
        {
          name: "Test Create Item"
        }
      ]
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
          type: "test.MainService.Header"
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
                type: "test.MainService.HeaderItem"
              },
              description: null,
              endAt: null,
              header_ID: id,
              name: "Test Create Item",
              startAt: null
            }
          ]
        }
      }
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
          type: "test.MainService.Header"
        },
        createdBy: "anonymous",
        modifiedBy: "anonymous",
        name: "Test Create",
        description: null,
        Items: {
          __deferred: {
            uri: `http://${response.request.host}/v2/main/Header(guid'${id}')/Items`
          }
        }
      }
    });
    response = await util.callRead(request, `/v2/main/Header(guid'${id}')/Items`);
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callWrite(request, `/v2/main/Header(guid'${id}')/Items`, {
      name: "Test Update"
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    itemId = response.body.d.ID;
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          uri: `http://${response.request.host}/v2/main/HeaderItem(guid'${itemId}')`,
          type: "test.MainService.HeaderItem"
        },
        name: "Test Update",
        description: null,
        startAt: null,
        endAt: null,
        header_ID: id,
        header: {
          __deferred: {
            uri: `http://${response.request.host}/v2/main/HeaderItem(guid'${itemId}')/header`
          }
        }
      }
    });
    response = await util.callRead(request, `/v2/main/Header(guid'${id}')/Items(guid'${itemId}')`);
    expect(response.body).toBeDefined();
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          uri: `http://${response.request.host}/v2/main/HeaderItem(guid'${itemId}')`,
          type: "test.MainService.HeaderItem"
        },
        name: "Test Update",
        description: null,
        startAt: null,
        endAt: null,
        header_ID: id,
        header: {
          __deferred: {
            uri: `http://${response.request.host}/v2/main/HeaderItem(guid'${itemId}')/header`
          }
        }
      }
    });
  });

  it("PUT request", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test"
    });
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callWrite(
      request,
      `/v2/main/Header(guid'${id}')`,
      {
        name: "Test2"
      },
      true
    );
    expect(response.statusCode).toEqual(200);
    response = await util.callRead(request, `/v2/main/Header(guid'${id}')`);
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          uri: `http://${response.request.host}/v2/main/Header(guid'${id}')`,
          type: "test.MainService.Header"
        },
        createdBy: "anonymous",
        modifiedBy: "anonymous",
        name: "Test2",
        description: null,
        Items: {
          __deferred: {
            uri: `http://${response.request.host}/v2/main/Header(guid'${id}')/Items`
          }
        }
      }
    });
    response = await util.callWrite(
      request,
      "/v2/main/Header",
      {
        name: "Test"
      },
      true
    );
    expect(response.body).toMatchObject({
      error: {
        code: "null",
        message: {
          lang: "en",
          value: "Method PATCH not allowed for ENTITY.COLLECTION"
        }
      }
    });
  });

  it("PUT request after GET", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test"
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
      name: "Test"
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
          value: "Not Found"
        }
      }
    });
  });

  it("GET unbound function request", async () => {
    let response = await util.callRead(request, `/v2/main/unboundFunction?num=1&text=abc`);
    expect(response.body).toMatchObject({
      d: {
        age: 1,
        code: "TEST",
        name: "abc"
      }
    });
    response = await util.callRead(request, `/v2/main/unboundDecimalFunction`);
    expect(response.body).toMatchObject({
      d: {
        value: "12345.6789"
      }
    });
    response = await util.callRead(request, `/v2/main/unboundDecimalsFunction`);
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            value: "12345.6789"
          },
          {
            value: "12345.6789"
          }
        ]
      }
    });
  });

  it("GET unbound function error request", async () => {
    let response = await util.callRead(request, `/v2/main/unboundErrorFunction`);
    expect(response.body).toMatchObject({
      error: {
        code: "ERR01",
        message: {
          lang: "en",
          value: "An error occurred"
        },
        target: "Items",
        severity: "error",
        innererror: {
          errordetails: [
            {
              code: "ERR02",
              message: "Error details",
              target: "Items",
              severity: "error"
            }
          ]
        }
      }
    });
  });

  it("GET unbound function warning request", async () => {
    let response = await util.callRead(request, `/v2/main/unboundWarningFunction`);
    expect(response.body).toMatchObject({
      d: {
        age: 1,
        code: "TEST",
        name: "Test"
      }
    });
    expect(JSON.parse(response.headers["sap-message"])).toEqual({
      message: "An Warning occurred",
      code: "WARN01",
      severity: "warning",
      target: "Items"
    });
  });

  it("GET unbound function with navigation", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test",
      Items: [
        {
          name: "TestItem"
        }
      ]
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    response = await util.callRead(request, `/v2/main/unboundNavigationFunction?num=1&text=${id}`);
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          type: "test.MainService.Header",
          uri: `http://${response.request.host}/v2/main/Header(guid'${id}')`
        },
        createdBy: "anonymous",
        modifiedBy: "anonymous",
        name: "Test",
        description: null
      }
    });
    response = await util.callRead(request, `/v2/main/unboundNavigationsFunction?num=1&text=abc`);
    expect(response.body.d.results.length > 0).toEqual(true);
    response = await util.callRead(request, `/v2/main/unboundNavigationFunction/Items?num=1&text=abc`);
    expect(response.body).toMatchObject({
      error: {
        code: "null",
        message: {
          lang: "en",
          value: `Current function 'unboundNavigationFunction' is not composable; trailing segment 'Items' ist not allowed`
        }
      }
    });
  });

  it("GET bound function request", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test"
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
            name: "abc"
          }
        ]
      }
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
            name: "abc"
          }
        ]
      }
    });
  });

  it("POST bound action request", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test"
    });
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callWrite(request, `/v2/main/Header_boundAction?ID=guid'${id}'&num=1&text=abc`);
    expect(response.body).toMatchObject({
      d: {
        age: 1,
        code: "TEST",
        name: "abc"
      }
    });
  });
});
