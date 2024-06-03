"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");
// eslint-disable-next-line no-restricted-modules
const fs = require("fs");

const util = require("./_env/util/request");

cds.test(__dirname + "/_env");

let request;

describe("main", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app.server);
  });

  it("Index page including V2 links", async () => {
    expect(cds.services["test.MainService"].$linkProviders.length).toEqual(2);
    const provider = cds.services["test.MainService"].$linkProviders[0];
    const link = provider("Header");
    expect(link).toEqual({
      href: "/odata/v2/main/Header",
      name: "Header (V2)",
      title: "OData V2",
    });
  });

  it("HEAD service", async () => {
    let response = await util.callHead(request, "/odata/v2/main");
    expect(response.status).toEqual(200);
    expect(response.text).not.toBeDefined();
    expect(response.headers).toMatchObject({
      "content-type": "application/json",
      dataserviceversion: "2.0",
    });
    response = await util.callHead(request, "/odata/v2/main/Header");
    expect(response.status).toEqual(405);
    response = await util.callHead(request, "/odata/v2/main/Header", {
      "content-type": "application/json",
    });
    expect(response.status).toEqual(405);
  });

  it("GET service JSON format", async () => {
    let response = await util.callRead(request, "/odata/v2/main", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.body.d.EntitySets.sort()).toMatchSnapshot();
    response = await util.callRead(request, "/odata/v2/main/", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.body.d.EntitySets.sort()).toMatchSnapshot();
    response = await util.callRead(request, "/odata/v2/main/?$format=json");
    expect(response.body).toBeDefined();
    expect(response.body.d.EntitySets.sort()).toMatchSnapshot();
  });

  it("HEAD $metadata", async () => {
    const response = await util.callHead(request, "/odata/v2/main/$metadata");
    expect(response.status).toEqual(200);
    expect(response.body).toBeDefined();
    expect(response.headers).toMatchObject({
      "content-type": "application/xml",
      dataserviceversion: "2.0",
      "transfer-encoding": "chunked",
    });
  });

  it("GET $metadata", async () => {
    const response = await util.callRead(request, "/odata/v2/main/$metadata", {
      accept: "application/xml",
    });
    expect(response.body).toBeDefined();
    expect(response.text).toMatchSnapshot();
  });

  it("GET $metadata with query options", async () => {
    const response = await util.callRead(request, "/odata/v2/main/$metadata?sap-value-list=none&sap-language=EN", {
      accept: "application/xml",
    });
    expect(response.body).toBeDefined();
    expect(response.text).toMatchSnapshot();
  });

  it("GET $metadata localized", async () => {
    let response = await util.callRead(request, "/odata/v2/main/$metadata", {
      accept: "application/xml",
      "accept-language": "de",
    });
    expect(response.body).toBeDefined();
    expect(response.text).toMatchSnapshot();
    expect(response.text).toMatch(/Angelegt am/);

    response = await util.callRead(request, "/odata/v2/main/$metadata", {
      "accept-language": "de-DE",
    });
    expect(response.body).toBeDefined();
    expect(response.text).toMatchSnapshot();
  });

  it("GET $metadata with propagated headers", async () => {
    const response = await util.callRead(request, "/odata/v2/main/$metadata", {
      accept: "application/xml",
      dwc_header: "on",
    });
    expect(response.body).toBeDefined();
    expect(response.text).toMatchSnapshot();
  });

  it("GET request", async () => {
    let response = await util.callRead(request, "/odata/v2/main/Header");
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(7);
    response = await util.callRead(request, "/odata/v2/main/Header?$inlinecount=allpages");
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(7);
    expect(response.body.d.__count).toEqual("7");
    const id = response.body.d.results[0].ID;
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${id}')`);
    expect(response.body.d.__metadata).toEqual({
      type: "test.MainService.Header",
      uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')`,
      media_src: undefined,
      content_type: undefined,
    });
    response = await util.callRead(request, `/odata/v2/main/HeaderAssocKey(guid'${id}')`);
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
            target: "/#TRANSIENT#",
          },
        ],
      },
      severity: "error",
      target: "/#TRANSIENT#",
    });
  });

  it("GET request with non-json accept", async () => {
    let response = await util.callRead(request, "/odata/v2/main/Header", {
      accept: "application/xml",
    });
    expect(response.text).toBeDefined();
    response = await util.callRead(request, "/odata/v2/main/Header?$format=atom");
    expect(response.text).toBeDefined();
    response = await util.callWrite(request, "/odata/v2/main/Header", "<xml/>", false, {
      "content-type": "application/atom+xml",
    });
    expect(response.text).toBeDefined();
  });

  it("GET request with sap-language", async () => {
    let response = await util.callRead(request, "/odata/v2/main/Header?sap-language=de");
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(8);
  });

  it("GET request with navigation", async () => {
    let response = await util.callRead(request, "/odata/v2/main/Header?$filter=country eq 'Germany'");
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(1);
    const ID = response.body.d.results[0].ID;
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${ID}')`);
    expect(response.body.d).toBeDefined();
    expect(response.body.d.ID).toEqual(ID);
    response = await util.callRead(request, `/odata/v2/main/Header(ID=guid'${ID}')`);
    expect(response.body.d).toBeDefined();
    expect(response.body.d.ID).toEqual(ID);
    response = await util.callRead(request, `/odata/v2/main/Header(ID=guid'${ID}')/Items`);
    expect(response.body.d.results).toBeDefined();
    expect(response.body.d.results.length).toEqual(2);
    response = await util.callRead(request, `/odata/v2/main/Header(ID=guid'${ID}')/$links/Items`);
    expect(response.body.d.results).toBeDefined();
    expect(response.body.d.results.length).toEqual(2);
  });

  it("GET request with $-options", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
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
      `/odata/v2/main/Header?$filter=ID eq guid'${id}'&$select=ID,name&$expand=FirstItem,Items&$skip=0&$top=1&$orderby=name asc&createdAt=datetime'123456'`,
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toMatchObject([
      {
        __metadata: {
          type: "test.MainService.Header",
          uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')`,
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
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
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
      `/odata/v2/main/Header?$filter=ID eq guid'${id}'&$expand=Items,Items/header,Items/header/Items&$select=ID,name,Items/ID,Items/name,Items/header/ID,Items/header/name`,
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results[0]).toMatchObject({
      __metadata: {
        uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')`,
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
                uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')`,
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
      `/odata/v2/main/Header?$filter=ID eq guid'${id}'&$expand=Items&$select=Items/name`,
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results[0]).toMatchObject({
      __metadata: {
        uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')`,
        type: "test.MainService.Header",
      },
      ID: id,
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
    response = await util.callRead(
      request,
      `/odata/v2/main/Header?$filter=ID eq guid'${id}'&$expand=Items&$select=name,Items/name`,
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results[0]).toMatchObject({
      __metadata: {
        uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')`,
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
          },
        ],
      },
    });
    response = await util.callRead(
      request,
      `/odata/v2/main/Header?$filter=ID eq guid'${id}'&$expand=Items&$select=Items/name,Items`,
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results[0]).toMatchObject({
      __metadata: {
        uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')`,
        type: "test.MainService.Header",
      },
      ID: id,
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
            NextItem_ID: null,
          },
        ],
      },
    });
  });

  it("GET request with $select on deferreds", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
      Items: [
        {
          name: "TestItem",
        },
      ],
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    const itemId = response.body.d.Items.results[0].ID;
    response = await util.callRead(request, `/odata/v2/main/Header?$filter=ID eq guid'${id}'&$select=ID,name`);
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toEqual([
      {
        __metadata: {
          type: "test.MainService.Header",
          uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')`,
        },
        ID: id,
        name: "Test",
      },
    ]);
    response = await util.callRead(request, `/odata/v2/main/Header?$filter=ID eq guid'${id}'&$select=ID,name,Items`);
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toEqual([
      {
        __metadata: {
          type: "test.MainService.Header",
          uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')`,
        },
        ID: id,
        name: "Test",
        Items: {
          __deferred: {
            uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')/Items`,
          },
        },
      },
    ]);
    response = await util.callRead(request, `/odata/v2/main/Header?$filter=ID eq guid'${id}'&$select=ID,name,Items/ID`);
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toEqual([
      {
        __metadata: {
          type: "test.MainService.Header",
          uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')`,
        },
        ID: id,
        name: "Test",
        Items: {
          __deferred: {
            uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')/Items`,
          },
        },
      },
    ]);
    response = await util.callRead(
      request,
      `/odata/v2/main/Header?$filter=ID eq guid'${id}'&$select=ID,name,Items/ID&$expand=Items`,
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toEqual([
      {
        __metadata: {
          type: "test.MainService.Header",
          uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')`,
        },
        ID: id,
        name: "Test",
        Items: {
          results: [
            {
              ID: itemId,
              __metadata: {
                type: "test.MainService.HeaderItem",
                uri: `http://${response.request.host.replace(
                  "127.0.0.1",
                  "localhost",
                )}/odata/v2/main/HeaderItem(guid'${itemId}')`,
              },
            },
          ],
        },
      },
    ]);
  });

  it("GET request with search", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.statusCode).toEqual(201);
    response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Search_Instance_Test",
    });
    expect(response.statusCode).toEqual(201);
    response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "hall\\ooo",
    });
    expect(response.statusCode).toEqual(201);
    response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: 'Search"Quote"',
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    response = await util.callRead(request, `/odata/v2/main/Header?search=Search_Instance`);
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(request, `/odata/v2/main/Header?$search=Search_Instance`);
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(request, `/odata/v2/main/Header/$count?search=Search_Instance`);
    expect(response.text).toEqual("1");
    response = await util.callRead(request, `/odata/v2/main/Header/$count?$search=Search_Instance`);
    expect(response.text).toEqual("1");
    response = await util.callRead(request, `/odata/v2/main/Header/$count?$search="Search_Instance"`);
    expect(response.text).toEqual("1");
    response = await util.callRead(request, `/odata/v2/main/Header/$count?search="`);
    expect(response.text).toEqual("2");
    response = await util.callRead(request, `/odata/v2/main/Header/$count?search=""`);
    expect(response.text).toEqual("0");
    response = await util.callRead(request, `/odata/v2/main/Header/$count?search=hall%5Cooo`);
    expect(response.text).toEqual("1");
    response = await util.callRead(request, `/odata/v2/main/Header/$count?search=`);
    expect(response.text).toEqual("15");
    response = await util.callRead(request, `/odata/v2/main/Header/$count?search="""`);
    expect(response.text).toEqual("0");
    response = await util.callRead(request, `/odata/v2/main/Header/$count?search=Search"Quote"`);
    expect(response.text).toEqual("1");
    response = await util.callRead(request, `/odata/v2/main/Header/$count?$search="Search\\"Quote\\""`);
    expect(response.text).toEqual("1");
    response = await util.callRead(request, `/odata/v2/main/Header/$count?$search="\\"\\""`);
    expect(response.text).toEqual("0");

    response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: '"',
    });
    expect(response.statusCode).toEqual(201);
    response = await util.callRead(request, `/odata/v2/main/Header/$count?search="`);
    expect(response.text).toEqual("3");
    response = await util.callRead(request, `/odata/v2/main/Header/$count?search=%22`);
    expect(response.text).toEqual("3");
    response = await util.callRead(request, `/odata/v2/main/Header/$count?search=%22%22%22`);
    expect(response.text).toEqual("0");
  });

  it("GET request with $count", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    response = await util.callRead(request, `/odata/v2/main/Header/$count?$filter=ID eq guid'${id}'`);
    expect(response.text).toEqual("1");
  });

  it("GET request with $value", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${id}')/ID`);
    expect(response.body).toEqual({
      d: {
        ID: id,
      },
    });
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${id}')/ID/$value`);
    expect(response.headers["content-type"]).toEqual("text/plain");
    expect(response.text).toEqual(id);
  });

  it("GET request with delta responses", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/HeaderDelta", {
      name: "Test",
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    response = await util.callRead(request, `/odata/v2/main/HeaderDelta?!deltatoken='${new Date().getTime()}'`);
    expect(response.statusCode).toEqual(200);
    expect(response.body.d.results).toBeDefined();
    expect(response.body.d.__delta).toMatch(
      /http:\/\/localhost:(\d*)\/odata\/v2\/main\/HeaderDelta\?!deltatoken='(\d*)'/,
    );
    response = await util.callRead(request, `/odata/v2/main/HeaderDelta(guid'${id}')`);
    expect(response.statusCode).toEqual(200);
    expect(response.body.d.results).toBeUndefined();

    response = await util.callRead(request, `/odata/v2/main/HeaderDelta(guid'${id}')/Items?$filter=name eq 'a /'`);
    expect(response.statusCode).toEqual(200);
    expect(response.body.d.results).toBeDefined();
    expect(response.body.d.__delta).toMatch(
      /http:\/\/localhost:(\d*)\/odata\/v2\/main\/HeaderDelta\(guid'.*?'\)\/Items\?\$filter=name eq 'a \/'&!deltatoken='(\d*)'/,
    );
  });

  it("GET request with next link responses", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.statusCode).toEqual(201);
    response = await util.callRead(request, "/odata/v2/main/Header?$skiptoken=1");
    expect(response.statusCode).toEqual(200);
    expect(response.body.d.results).toBeDefined();
    expect(response.body.d.__next).toBeUndefined(); // Limit (1000) larger than result size

    response = await util.callRead(request, "/odata/v2/main/FavoriteLimited");
    expect(response.statusCode).toEqual(200);
    expect(response.body.d.results).toBeDefined();
    expect(response.body.d.results).toHaveLength(1);
    expect(response.body.d.__next).toMatch(/http:\/\/localhost:(\d*)\/odata\/v2\/main\/FavoriteLimited\?\$skiptoken=1/);
    const nextUrl = response.body.d.__next.match(/http:\/\/localhost:\d*(.*)/)[1];
    response = await util.callRead(request, nextUrl);
    expect(response.body.d.results).toBeDefined();
    expect(response.body.d.results).toHaveLength(1);
    expect(response.body.d.__next).toMatch(/http:\/\/localhost:(\d*)\/odata\/v2\/main\/FavoriteLimited\?\$skiptoken=2/);
  });

  it("GET request with stream", async () => {
    const id = "f8a7a4f7-1901-4032-a237-3fba1d1b2343";
    let response = await util.callRead(request, `/odata/v2/main/HeaderStream(guid'${id}')`);
    expect(response.body.d).toEqual({
      ID: id,
      __metadata: {
        content_type: "image/png",
        media_src: `http://${response.request.host.replace(
          "127.0.0.1",
          "localhost",
        )}/odata/v2/main/HeaderStream(guid'${id}')/$value`,
        type: "test.MainService.HeaderStream",
        uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/HeaderStream(guid'${id}')`,
      },
      custom: null,
      filename: "file.png",
      isBlocked: null,
      mediaType: "image/png",
      totalAmount: null,
    });
    const mediaSrc = response.body.d.__metadata.media_src.substr(
      response.body.d.__metadata.media_src.indexOf("/odata/v2"),
    );
    response = await util.callRead(request, mediaSrc);
    expect(response.statusCode).toEqual(200);
    expect(response.body.length).toBe(17686);
    expect(response.headers["transfer-encoding"]).toEqual("chunked");
    expect(response.headers["content-type"]).toEqual("image/png");
    expect(response.headers["content-disposition"]).toEqual('attachment; filename="file.png"');
    response = await util.callRead(
      request,
      "/odata/v2/main/HeaderStream(guid'f8a7a4f7-1901-4032-a237-3fba1d1b2343')/data",
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body.length).toBe(17686);
    expect(response.headers["transfer-encoding"]).toEqual("chunked");
    expect(response.headers["content-type"]).toEqual("image/png");
    expect(response.headers["content-disposition"]).toEqual('attachment; filename="file.png"');
    response = await util.callRead(
      request,
      "/odata/v2/main/HeaderStream(guid'f8a7a4f7-1901-4032-a237-3fba1d1b2343')/data/$value",
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body.length).toBe(17686);
    expect(response.headers["transfer-encoding"]).toEqual("chunked");
    expect(response.headers["content-type"]).toEqual("image/png");
    expect(response.headers["content-disposition"]).toEqual('attachment; filename="file.png"');
    response = await util.callRead(
      request,
      `/odata/v2/main/HeaderStream(guid'f8a7a4f7-1901-4032-a237-3fba1d1b2343')/$value`,
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body.length).toBe(17686);
    expect(response.headers["transfer-encoding"]).toEqual("chunked");
    expect(response.headers["content-type"]).toEqual("image/png");
    expect(response.headers["content-disposition"]).toEqual('attachment; filename="file.png"');
    response = await util.callRead(
      request,
      "/odata/v2/main/HeaderStreamAttachment(guid'f8a7a4f7-1901-4032-a237-3fba1d1b2343')/$value",
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body.length).toBe(17686);
    expect(response.headers["transfer-encoding"]).toEqual("chunked");
    expect(response.headers["content-type"]).toEqual("image/png");
    expect(response.headers["content-disposition"]).toEqual('attachment; filename="file.png"');
  });

  it("GET request with url stream", async () => {
    let response = await util.callRead(
      request,
      "/odata/v2/main/HeaderUrlStream(guid'f8a7a4f7-1901-4032-a237-3fba1d1b2343')/link",
      {
        accept: "image/png",
      },
    );
    expect(response.statusCode).toEqual(200);
    response = await util.callRead(
      request,
      "/odata/v2/main/HeaderUrlStream(guid'f8a7a4f7-1901-4032-a237-3fba1d1b2343')/link",
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body.length).toBe(17686);
    expect(response.headers["transfer-encoding"]).toEqual("chunked");
    expect(response.headers["content-type"]).toEqual("image/png");
    expect(response.headers["content-disposition"]).toEqual('attachment; filename="file.png"');
    expect(response.statusCode).toEqual(200);
    response = await util.callRead(
      request,
      "/odata/v2/main/HeaderUrlStream(guid'f8a7a4f7-1901-4032-a237-3fba1d1b2343')/link/$value",
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body.length).toBe(17686);
    expect(response.headers["transfer-encoding"]).toEqual("chunked");
    expect(response.headers["content-type"]).toEqual("image/png");
    expect(response.headers["content-disposition"]).toEqual('attachment; filename="file.png"');
    response = await util.callRead(
      request,
      "/odata/v2/main/HeaderUrlStream(guid'f8a7a4f7-1901-4032-a237-3fba1d1b2343')/$value",
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body.length).toBe(17686);
    expect(response.headers["transfer-encoding"]).toEqual("chunked");
    expect(response.headers["content-type"]).toEqual("image/png");
    expect(response.headers["content-disposition"]).toEqual('attachment; filename="file.png"');
    response = await util.callRead(
      request,
      "/odata/v2/main/HeaderUrlStream(guid'e8a7a4f7-1901-4032-a237-3fba1d1b2343')/$value",
    );
    expect(response.statusCode).toEqual(500);
    expect(response.body.error.message.value).toEqual("fetch failed");
    response = await util.callRead(
      request,
      "/odata/v2/main/HeaderUrlStream(guid'a8a7a4f7-1901-4032-a237-3fba1d1b2343')/$value",
      {
        accept: "image/png",
      },
    );
    expect(response.statusCode).toEqual(400);
    expect(response.body).toEqual({
      error: {
        code: "400",
        message: {
          lang: "en",
          value: "Expected uri token 'EOF' could not be found in '$value2' at position 7",
        },
        innererror: {
          errordetails: [
            {
              code: "400",
              message: {
                lang: "en",
                value: "Expected uri token 'EOF' could not be found in '$value2' at position 7",
              },
              severity: "error",
              target: "/#TRANSIENT#",
            },
          ],
        },
        severity: "error",
        target: "/#TRANSIENT#",
      },
    });
  });

  it("PUT request with stream", async () => {
    const error = await new Promise((done) => {
      util
        .callWrite(request, "/odata/v2/main/HeaderStream", {
          mediaType: "image/png",
          filename: "test.png",
        })
        .then((createResponse) => {
          expect(createResponse.statusCode).toEqual(201);
          const id = createResponse.body.d.ID;
          const stream = fs.createReadStream(__dirname + "/_env/srv/init/assets/file.png");
          const req = util.callStream(request, `/odata/v2/main/HeaderStream(guid'${id}')/data`, true, {
            "content-type": "image/png",
          });
          req.expect(204);
          stream.on("end", async () => {
            req.end(async (err) => {
              if (!err) {
                let readResponse = await util.callRead(request, `/odata/v2/main/HeaderStream(guid'${id}')/data`);
                expect(readResponse.statusCode).toEqual(200);
                expect(readResponse.headers["content-type"]).toEqual("image/png");
                expect(readResponse.body.length).toEqual(17686);
                let deleteResponse = await util.callDelete(request, `/odata/v2/main/HeaderStream(guid'${id}')/data`);
                expect(deleteResponse.statusCode).toEqual(204);
                readResponse = await util.callRead(request, `/odata/v2/main/HeaderStream(guid'${id}')/data`);
                expect(readResponse.statusCode).toEqual(204);
                deleteResponse = await util.callDelete(request, `/odata/v2/main/HeaderStream(guid'${id}')`);
                expect(deleteResponse.statusCode).toEqual(204);
                readResponse = await util.callRead(request, `/odata/v2/main/HeaderStream(guid'${id}')`);
                expect(readResponse.statusCode).toEqual(404);
              }
              done(err);
            });
          });
          stream.pipe(req, { end: false });
        });
    });
    expect(error).toEqual(null);
  });

  it("PUT request with binary", async () => {
    const file = fs.readFileSync(__dirname + "/_env/srv/init/assets/file.png");
    const createResponse = await util.callWrite(request, "/odata/v2/main/HeaderStream", {
      mediaType: "image/png",
      filename: "test.png",
    });
    expect(createResponse.statusCode).toEqual(201);
    const id = createResponse.body.d.ID;
    const dataResponse = await util.callBinary(request, `/odata/v2/main/HeaderStream(guid'${id}')/data`, file, true, {
      "content-type": "image/png",
    });
    expect(dataResponse.statusCode).toEqual(204);
    let readResponse = await util.callRead(request, `/odata/v2/main/HeaderStream(guid'${id}')/data`);
    expect(readResponse.statusCode).toEqual(200);
    expect(readResponse.headers["content-type"]).toEqual("image/png");
    expect(readResponse.body.length).toEqual(17686);
    let deleteResponse = await util.callDelete(request, `/odata/v2/main/HeaderStream(guid'${id}')/data`);
    expect(deleteResponse.statusCode).toEqual(204);
    readResponse = await util.callRead(request, `/odata/v2/main/HeaderStream(guid'${id}')/data`);
    expect(readResponse.statusCode).toEqual(204);
    deleteResponse = await util.callDelete(request, `/odata/v2/main/HeaderStream(guid'${id}')`);
    expect(deleteResponse.statusCode).toEqual(204);
    readResponse = await util.callRead(request, `/odata/v2/main/HeaderStream(guid'${id}')`);
    expect(readResponse.statusCode).toEqual(404);
  });

  it("POST request with stream", async () => {
    const error = await new Promise((done) => {
      const stream = fs.createReadStream(__dirname + "/_env/srv/init/assets/file.png");
      const req = util.callStream(request, "/odata/v2/main/HeaderStream", false, {
        "content-type": "image/png",
        slug: "file.png",
        custom: "test123",
        totalAmount: "11",
        isBlocked: "true",
      });
      req.expect(201);
      stream.on("end", async () => {
        req.end(async (err, createResponse) => {
          if (!err) {
            const id = createResponse.body.d.ID;
            let readResponse = await util.callRead(request, `/odata/v2/main/HeaderStream(guid'${id}')`);
            expect(readResponse.statusCode).toEqual(200);
            expect(readResponse.body.d).toMatchObject({
              ID: id,
              filename: "file.png",
              mediaType: "image/png",
              custom: "test123",
              totalAmount: 11,
              isBlocked: true,
            });
            readResponse = await util.callRead(request, `/odata/v2/main/HeaderStream(guid'${id}')/data`);
            expect(readResponse.statusCode).toEqual(200);
            expect(readResponse.headers["content-type"]).toEqual("image/png");
            expect(readResponse.body.length).toEqual(17686);
            let deleteResponse = await util.callDelete(request, `/odata/v2/main/HeaderStream(guid'${id}')/data`);
            expect(deleteResponse.statusCode).toEqual(204);
            readResponse = await util.callRead(request, `/odata/v2/main/HeaderStream(guid'${id}')/data`);
            expect(readResponse.statusCode).toEqual(204);
            deleteResponse = await util.callDelete(request, `/odata/v2/main/HeaderStream(guid'${id}')`);
            expect(deleteResponse.statusCode).toEqual(204);
            readResponse = await util.callRead(request, `/odata/v2/main/HeaderStream(guid'${id}')`);
            expect(readResponse.statusCode).toEqual(404);
          }
          done(err);
        });
      });
      stream.pipe(req, { end: false });
    });
    expect(error).toEqual(null);
  });

  it("POST request with binary", async () => {
    const file = fs.readFileSync(__dirname + "/_env/srv/init/assets/file.png");
    const createResponse = await util.callBinary(request, "/odata/v2/main/HeaderStream", file, false, {
      "content-type": "image/png",
      slug: "file.png",
      custom: "test123",
      totalAmount: "11",
      isBlocked: "false",
    });
    expect(createResponse.statusCode).toEqual(201);
    const id = createResponse.body.d.ID;
    let readResponse = await util.callRead(request, `/odata/v2/main/HeaderStream(guid'${id}')`);
    expect(readResponse.statusCode).toEqual(200);
    expect(readResponse.body.d).toMatchObject({
      ID: id,
      filename: "file.png",
      mediaType: "image/png",
      custom: "test123",
      totalAmount: 11,
      isBlocked: false,
    });
    readResponse = await util.callRead(request, `/odata/v2/main/HeaderStream(guid'${id}')/data`);
    expect(readResponse.statusCode).toEqual(200);
    expect(readResponse.headers["content-type"]).toEqual("image/png");
    expect(readResponse.body.length).toEqual(17686);
    let deleteResponse = await util.callDelete(request, `/odata/v2/main/HeaderStream(guid'${id}')/data`);
    expect(deleteResponse.statusCode).toEqual(204);
    readResponse = await util.callRead(request, `/odata/v2/main/HeaderStream(guid'${id}')/data`);
    expect(readResponse.statusCode).toEqual(204);
    deleteResponse = await util.callDelete(request, `/odata/v2/main/HeaderStream(guid'${id}')`);
    expect(deleteResponse.statusCode).toEqual(204);
    readResponse = await util.callRead(request, `/odata/v2/main/HeaderStream(guid'${id}')`);
    expect(readResponse.statusCode).toEqual(404);
  });

  it("POST request with binary with header decode", async () => {
    const file = fs.readFileSync(__dirname + "/_env/srv/init/assets/file.png");
    const createResponse = await util.callBinary(request, "/odata/v2/main/HeaderStreamDecode", file, false, {
      "content-type": "image/png",
      slug: new Buffer(encodeURIComponent("test/file?&.png")).toString("base64"),
      custom: "test123",
      totalAmount: "11",
      isBlocked: "false",
    });
    expect(createResponse.statusCode).toEqual(201);
    const id = createResponse.body.d.ID;
    let readResponse = await util.callRead(request, `/odata/v2/main/HeaderStreamDecode(guid'${id}')`);
    expect(readResponse.statusCode).toEqual(200);
    expect(readResponse.body.d).toMatchObject({
      ID: id,
      filename: "test/file?&.png",
      mediaType: "image/png",
      custom: "test123",
      totalAmount: 11,
      isBlocked: false,
    });
    readResponse = await util.callRead(request, `/odata/v2/main/HeaderStreamDecode(guid'${id}')/data`);
    expect(readResponse.statusCode).toEqual(200);
    expect(readResponse.headers["content-type"]).toEqual("image/png");
    expect(readResponse.body.length).toEqual(17686);
    let deleteResponse = await util.callDelete(request, `/odata/v2/main/HeaderStreamDecode(guid'${id}')/data`);
    expect(deleteResponse.statusCode).toEqual(204);
    readResponse = await util.callRead(request, `/odata/v2/main/HeaderStreamDecode(guid'${id}')/data`);
    expect(readResponse.statusCode).toEqual(204);
    deleteResponse = await util.callDelete(request, `/odata/v2/main/HeaderStreamDecode(guid'${id}')`);
    expect(deleteResponse.statusCode).toEqual(204);
    readResponse = await util.callRead(request, `/odata/v2/main/HeaderStreamDecode(guid'${id}')`);
    expect(readResponse.statusCode).toEqual(404);
  });

  it("POST request with multipart form-data stream", async () => {
    const stream = fs.createReadStream(__dirname + "/_env/srv/init/assets/file.png");
    const createResponse = await util.callAttach(
      request,
      "/odata/v2/main/HeaderStream",
      stream,
      false,
      {
        "content-type": "image/png",
        "Content-Disposition": `inline; name="field"; filename="file.png"`,
      },
      {
        "Content-Disposition": `inline; name="field"; filename="file.png"`,
        custom: "test123",
        totalAmount: "11",
        isBlocked: "true",
      },
    );
    expect(createResponse.statusCode).toEqual(201);
    const id = createResponse.body.d.ID;
    let readResponse = await util.callRead(request, `/odata/v2/main/HeaderStream(guid'${id}')`);
    expect(readResponse.statusCode).toEqual(200);
    expect(readResponse.body.d).toMatchObject({
      ID: id,
      filename: "file.png",
      mediaType: "image/png",
      custom: "test123",
      totalAmount: 11,
      isBlocked: true,
    });
    readResponse = await util.callRead(request, `/odata/v2/main/HeaderStream(guid'${id}')/data`);
    expect(readResponse.statusCode).toEqual(200);
    expect(readResponse.headers["content-type"]).toEqual("image/png");
    expect(readResponse.body.length).toEqual(17686);
    let deleteResponse = await util.callDelete(request, `/odata/v2/main/HeaderStream(guid'${id}')/data`);
    expect(deleteResponse.statusCode).toEqual(204);
    readResponse = await util.callRead(request, `/odata/v2/main/HeaderStream(guid'${id}')/data`);
    expect(readResponse.statusCode).toEqual(204);
    deleteResponse = await util.callDelete(request, `/odata/v2/main/HeaderStream(guid'${id}')`);
    expect(deleteResponse.statusCode).toEqual(204);
    readResponse = await util.callRead(request, `/odata/v2/main/HeaderStream(guid'${id}')`);
    expect(readResponse.statusCode).toEqual(404);
  });

  it("POST request with multipart form-data binary", async () => {
    const createResponse = await util.callAttach(
      request,
      "/odata/v2/main/HeaderStream",
      __dirname + "/_env/srv/init/assets/file.png",
      false,
      {
        "content-type": "image/png",
      },
      {
        custom: "test123",
        totalAmount: "11",
        isBlocked: "false",
      },
    );
    expect(createResponse.statusCode).toEqual(201);
    const id = createResponse.body.d.ID;
    let readResponse = await util.callRead(request, `/odata/v2/main/HeaderStream(guid'${id}')`);
    expect(readResponse.statusCode).toEqual(200);
    expect(readResponse.body.d).toMatchObject({
      ID: id,
      filename: "file.png",
      mediaType: "image/png",
      custom: "test123",
      totalAmount: 11,
      isBlocked: false,
    });
    readResponse = await util.callRead(request, `/odata/v2/main/HeaderStream(guid'${id}')/data`);
    expect(readResponse.statusCode).toEqual(200);
    expect(readResponse.headers["content-type"]).toEqual("image/png");
    expect(readResponse.body.length).toEqual(17686);
    let deleteResponse = await util.callDelete(request, `/odata/v2/main/HeaderStream(guid'${id}')/data`);
    expect(deleteResponse.statusCode).toEqual(204);
    readResponse = await util.callRead(request, `/odata/v2/main/HeaderStream(guid'${id}')/data`);
    expect(readResponse.statusCode).toEqual(204);
    deleteResponse = await util.callDelete(request, `/odata/v2/main/HeaderStream(guid'${id}')`);
    expect(deleteResponse.statusCode).toEqual(204);
    readResponse = await util.callRead(request, `/odata/v2/main/HeaderStream(guid'${id}')`);
    expect(readResponse.statusCode).toEqual(404);
  });

  it("POST request with binary returning error", async () => {
    const file = fs.readFileSync(__dirname + "/_env/srv/init/assets/file.png");
    const response = await util.callBinary(request, "/odata/v2/main/HeaderStream", file, false, {
      Authorization: "Basic ABC123",
      "content-type": "image/png",
      slug: "file_error.png",
      custom: "test123",
      totalAmount: "11",
      isBlocked: "true",
    });
    expect(response.statusCode).toEqual(400);
    expect(response.body).toEqual({
      error: {
        code: "400",
        message: {
          lang: "en",
          value: "Filename contains error",
        },
        severity: "error",
        target: "/#TRANSIENT#",
        innererror: {
          errordetails: [
            {
              code: "400",
              message: {
                lang: "en",
                value: "Filename contains error",
              },
              severity: "error",
              target: "/#TRANSIENT#",
            },
          ],
        },
      },
    });
  });

  it("POST request with binary without media type annotations fails", async () => {
    const file = fs.readFileSync(__dirname + "/_env/srv/init/assets/file.png");
    const createResponse = await util.callBinary(request, "/odata/v2/main/HeaderBinary", file, false, {
      "content-type": "image/png",
      name: "test",
    });
    expect(createResponse.statusCode).toEqual(400);
    expect(createResponse.body.error).toMatchObject({
      code: "400",
      message: {
        lang: "en",
        value: "No payload deserializer available for resource kind 'PRIMITIVE' and mime type 'image/png'",
      },
      severity: "error",
      target: "/#TRANSIENT#",
      innererror: {
        errordetails: [
          {
            code: "400",
            message: {
              lang: "en",
              value: "No payload deserializer available for resource kind 'PRIMITIVE' and mime type 'image/png'",
            },
            severity: "error",
            target: "/#TRANSIENT#",
          },
        ],
      },
    });
  });

  it("POST request with deep data containing metadata", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
      Items: [
        {
          name: "TestItem",
        },
      ],
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    response = await util.callRead(request, `/odata/v2/main/Header?$filter=ID eq guid'${id}'&$expand=Items`);
    expect(response.body).toBeDefined();
    let data = response.body.d.results[0];
    expect(data).toMatchObject({
      __metadata: {
        uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')`,
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
          },
        ],
      },
    });
    data.name = "Test2";
    data.Items.results[0].name = "TestItem2";
    response = await util.callWrite(request, `/odata/v2/main/Header(guid'${id}')`, data, true);
    expect(response.statusCode).toEqual(200);
    response = await util.callRead(request, `/odata/v2/main/Header?$filter=ID eq guid'${id}'&$expand=Items`);
    expect(response.body).toBeDefined();
    data = response.body.d.results[0];
    expect(data).toMatchObject({
      __metadata: {
        uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')`,
        type: "test.MainService.Header",
      },
      ID: id,
      name: "Test2",
      Items: {
        results: [
          {
            __metadata: {
              type: "test.MainService.HeaderItem",
            },
            name: "TestItem2",
          },
        ],
      },
    });
  });

  it("GET request with function 'substringof'", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    response = await util.callRead(
      request,
      `/odata/v2/main/Header?$filter=ID eq guid'${id}' and substringof('ES',name)`,
    );
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(
      request,
      `/odata/v2/main/Header?$filter=ID eq guid'${id}' and substringof('es',tolower(name))`,
    );
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(
      request,
      `/odata/v2/main/Header?$filter=ID eq guid'${id}' and substringof('es',tolower(name)) or name eq 'ABC'`,
    );
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(
      request,
      `/odata/v2/main/Header?$filter=ID eq guid'${id}' and substringof('es',tolower(name))%20or%20name%20eq 'ABC'`,
    );
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(
      request,
      `/odata/v2/main/Header?$filter=ID eq guid'${id}' and substringof('es',tolower(name)) or substringof(')es , ''''and (t) substringof(''es'',tolower(name))',tolower(name))`,
    );
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(
      request,
      `/odata/v2/main/Header?$filter=(ID eq guid'${id}' and (substringof('es',tolower(name)) or (substringof(')es , ''''and (t) substringof(''es'',tolower(name))',tolower(name)))))`,
    );
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(
      request,
      `/odata/v2/main/Header?$filter=ID eq guid'${id}' and substringof(tolower('ES'),tolower(name))`,
    );
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(
      request,
      `/odata/v2/main/Header?$filter=ID eq guid'${id}' and substringof(tolower(tolower('ES')),tolower(tolower(name)))`,
    );
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(
      request,
      `/odata/v2/main/Header?$filter=ID eq guid'${id}' and substringof('es', name)`,
    );
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(
      request,
      `/odata/v2/main/Header?$filter=ID eq guid'${id}' and substringof( 'es',name)`,
    );
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(
      request,
      `/odata/v2/main/Header?$filter=ID eq guid'${id}' and substringof( tolower('es'), tolower(name))`,
    );
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "substringof('es',name)",
    });
    expect(response.statusCode).toEqual(201);
    response = await util.callRead(
      request,
      `/odata/v2/main/Header?$filter=substringof('substringof(''es'',name)',name)`,
    );
    expect(response.body.d.results).toHaveLength(1);
  });

  it("GET request with function 'substringof' incl. $", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test$",
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    response = await util.callRead(
      request,
      `/odata/v2/main/Header?$filter=ID eq guid'${id}' and substringof('st$',name)`,
    );
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(
      request,
      `/odata/v2/main/Header?$filter=ID eq guid'${id}' and substringof('$',name)`,
    );
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(
      request,
      `/odata/v2/main/Header?$filter=ID eq guid'${id}' and substringof('$$',name)`,
    );
    expect(response.body.d.results).toHaveLength(0);
  });

  it("GET request with function 'substringof' and 'startswith'", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    response = await util.callRead(
      request,
      `/odata/v2/main/Header?$filter=ID eq guid'${id}' or substringof('er',createdBy) or startswith(createdBy,'By')&$select=ID,name,createdBy`,
    );
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(
      request,
      `/odata/v2/main/Header?$filter=ID eq guid'${id}' and startswith(createdBy,'ANO')&$select=ID,name,createdBy`,
    );
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(
      request,
      `/odata/v2/main/Header?$filter=ID eq guid'${id}' and endswith(createdBy,'MOUS')&$select=ID,name,createdBy`,
    );
    expect(response.body.d.results).toHaveLength(1);
  });

  it('GET request with many "or" filters on same field', async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
      country: "US",
    });
    expect(response.statusCode).toEqual(201);
    response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
      country: "DE",
    });
    expect(response.statusCode).toEqual(201);
    response = await util.callRead(request, "/odata/v2/main/Header?$filter=country eq 'X' or country eq 'A'");
    expect(response.body.d.results).toHaveLength(0);
  });

  it("GET request with filter and data type conversion", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
      stock: 999,
      country: "US",
    });
    response = await util.callRead(request, "/odata/v2/main/Header?$filter=stock eq 999");
    expect(response.body.d.results).toHaveLength(1);
  });

  it("GET request with filter and data type conversion on navigation fields", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      ID: "1b089301-0d04-4005-b45c-c8ee801212a7",
      name: "Test",
      stock: 1001,
      country: "US",
      FirstItem_ID: "2b089301-0d04-4005-b45c-c8ee801212a7",
      Items: [
        {
          ID: "2b089301-0d04-4005-b45c-c8ee801212a7",
          name: "TestItem1001",
          startAt: "/Date(1586815200000)/",
          NextItem_ID: "3b089301-0d04-4005-b45c-c8ee801212a7",
        },
        {
          ID: "3b089301-0d04-4005-b45c-c8ee801212a7",
          name: "TestItem1002",
          startAt: "/Date(1586815200000)/",
          NextItem_ID: "2b089301-0d04-4005-b45c-c8ee801212a7",
        },
      ],
    });
    expect(response.statusCode).toBe(201);
    response = await util.callRead(request, "/odata/v2/main/Header?$expand=Items&$filter=stock eq 1001");
    expect(response.body.d.results).toHaveLength(1);
    const ID = response.body.d.results[0].ID;
    expect(response.body.d.results[0].Items.results).toHaveLength(2);
    response = await util.callRead(
      request,
      "/odata/v2/main/Header?$expand=FirstItem&$filter=stock eq 1001 and FirstItem/NextItem/name eq 'TestItem1002'",
    );
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(
      request,
      "/odata/v2/main/Header?$expand=FirstItem&$filter=stock eq 1001 and FirstItem/startAt eq datetimeoffset'2020-04-13T22:00:00.000Z'",
    );
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(
      request,
      "/odata/v2/main/Header?$expand=FirstItem&$filter=FirstItem/name eq 'TestItem1001'",
    );
    expect(response.body.d.results).toHaveLength(1);
  });

  it("GET request with uri escape character", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test %22",
      country: "US",
    });
    expect(response.statusCode).toEqual(201);
    const ID = response.body.d.ID;
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${ID}')`);
    expect(response.body.d).toMatchObject({
      ID,
      name: "Test %22",
      country: "US",
    });
    response = await util.callRead(request, encodeURI("/odata/v2/main/Header?$filter=name eq 'Test %22'"));
    expect(response.body.d.results).toHaveLength(1);
  });

  it("POST request", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
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
    expect(response.headers.location).toEqual(
      `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')`,
    );
    let itemId = response.body.d.Items.results[0].ID;
    expect(itemId).toBeDefined();
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')`,
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
    expect(/\/Date\(.+?\+0000\)\//.test(response.body.d.createdAt)).toEqual(true);
    const createdAt = new Date(parseInt(response.body.d.createdAt.substring(6, response.body.d.createdAt.length - 2)));
    expect(createdAt.toString()).not.toEqual("Invalid Date");
    response = await util.callRead(request, "/odata/v2/main/Header?$filter=name eq 'Test Create'");
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${id}')`);
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')`,
          type: "test.MainService.Header",
        },
        createdBy: "anonymous",
        modifiedBy: "anonymous",
        name: "Test Create",
        description: null,
        Items: {
          __deferred: {
            uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')/Items`,
          },
        },
      },
    });
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${id}')/Items`);
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callWrite(request, `/odata/v2/main/Header(guid'${id}')/Items`, {
      name: "Test Update",
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    itemId = response.body.d.ID;
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/HeaderItem(guid'${itemId}')`,
          type: "test.MainService.HeaderItem",
        },
        name: "Test Update",
        description: null,
        startAt: null,
        endAt: null,
        header_ID: id,
        header: {
          __deferred: {
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost",
            )}/odata/v2/main/HeaderItem(guid'${itemId}')/header`,
          },
        },
      },
    });
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${id}')/Items(guid'${itemId}')`);
    expect(response.body).toBeDefined();
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/HeaderItem(guid'${itemId}')`,
          type: "test.MainService.HeaderItem",
        },
        name: "Test Update",
        description: null,
        startAt: null,
        endAt: null,
        header_ID: id,
        header: {
          __deferred: {
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost",
            )}/odata/v2/main/HeaderItem(guid'${itemId}')/header`,
          },
        },
      },
    });
  });

  it("POST request with artificial structures", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      d: {
        __metadata: {
          type: "test.MainService.Header",
        },
        name: "Test Create",
        FirstItem: {
          __deferred: {},
        },
        Items: {
          results: [
            {
              name: "Test Create Item",
            },
          ],
        },
      },
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    const id = response.body.d.ID;
    expect(id).toBeDefined();
    expect(response.headers.location).toEqual(
      `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')`,
    );
    let itemId = response.body.d.Items.results[0].ID;
    expect(itemId).toBeDefined();
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')`,
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
  });

  it("PUT request", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callWrite(
      request,
      `/odata/v2/main/Header(guid'${id}')`,
      {
        name: "Test2",
      },
      true,
    );
    expect(response.statusCode).toEqual(200);
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${id}')`);
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')`,
          type: "test.MainService.Header",
        },
        createdBy: "anonymous",
        modifiedBy: "anonymous",
        name: "Test2",
        description: null,
        Items: {
          __deferred: {
            uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')/Items`,
          },
        },
      },
    });
    response = await util.callWrite(
      request,
      "/odata/v2/main/Header",
      {
        name: "Test",
      },
      true,
    );
    expect(response.body).toMatchObject({
      error: {
        code: "405",
        message: {
          lang: "en",
          value: "Method PATCH not allowed for ENTITY.COLLECTION",
        },
        severity: "error",
        innererror: {
          errordetails: [
            {
              code: "405",
              message: {
                lang: "en",
                value: "Method PATCH not allowed for ENTITY.COLLECTION",
              },
              severity: "error",
            },
          ],
        },
      },
    });
  });

  it("POST request with encoding", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test: èèòàù",
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    let id = response.body.d.ID;
    expect(id).toBeDefined();
    expect(response.body.d.name).toEqual("Test: èèòàù");
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${id}')`);
    expect(response.statusCode).toEqual(200);
    expect(response.body.d.name).toEqual("Test: èèòàù");
    expect(response.headers["content-type"]).toEqual("application/json");

    response = await util.callWrite(
      request,
      "/odata/v2/main/Header",
      {
        name: "Test: èèòàù",
      },
      false,
      {
        "content-type": "application/json; charset=utf-8",
      },
    );
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    id = response.body.d.ID;
    expect(id).toBeDefined();
    expect(response.body.d.name).toEqual("Test: èèòàù");
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${id}')`);
    expect(response.statusCode).toEqual(200);
    expect(response.body.d.name).toEqual("Test: èèòàù");
    expect(response.headers["content-type"]).toEqual("application/json");
  });

  it("POST request with x-http-method", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callWrite(
      request,
      `/odata/v2/main/Header(guid'${id}')`,
      {
        name: "Test2",
      },
      false,
      {
        "x-http-method": "MERGE",
      },
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body.d.name).toEqual("Test2");
  });

  it("PUT request after GET", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.body).toBeDefined();
    let body = response.body;
    const id = body.d.ID;
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${id}')`);
    body = response.body;
    body.d.name = "Test2";
    response = await util.callWrite(request, `/odata/v2/main/Header(guid'${id}')`, body.d, true);
    expect(response.statusCode).toEqual(200);
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${id}')`);
    expect(response.body.d.name).toEqual("Test2");
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${id}')?$expand=Items,FirstItem`);
    body = response.body;
    body.d.name = "Test3";
    response = await util.callWrite(request, `/odata/v2/main/Header(guid'${id}')`, body.d, true);
    expect(response.statusCode).toEqual(200);
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${id}')`);
    expect(response.body.d.name).toEqual("Test3");
  });

  it("DELETE request", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callDelete(request, `/odata/v2/main/Header(guid'${id}')`);
    expect(response.statusCode).toEqual(204);
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${id}')`);
    expect(response.statusCode).toEqual(404);
    response = await util.callDelete(request, `/odata/v2/main/Header(guid'${id}')`);
    expect(response.statusCode).toEqual(404);
    expect(response.body).toMatchObject({
      error: {
        code: "404",
        message: {
          lang: "en",
          value: "Not Found",
        },
        severity: "error",
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
      },
    });
  });

  it("GET unbound function", async () => {
    let response = await util.callRead(request, "/odata/v2/main/unboundFunction?num=1&text=abc");
    expect(response.body).toMatchObject({
      d: {
        unboundFunction: {
          age: 1,
          code: "TEST",
          name: "abc",
          __metadata: {
            type: "test.MainService.Result",
          },
        },
      },
    });
    response = await util.callRead(request, "/odata/v2/main/unboundFunctionInline?num=1&text=abc");
    expect(response.body).toMatchObject({
      d: {
        unboundFunctionInline: {
          age: 1,
          code: "TEST",
          name: "abc",
          __metadata: {
            type: "test.MainService.return_test_MainService_unboundFunctionInline",
          },
        },
      },
    });
    response = await util.callRead(request, "/odata/v2/main/unboundFunction?num=1&text=a%20b%2Fc");
    expect(response.body).toMatchObject({
      d: {
        unboundFunction: {
          age: 1,
          code: "TEST",
          name: "a b/c",
          __metadata: {
            type: "test.MainService.Result",
          },
        },
      },
    });
    response = await util.callRead(request, "/odata/v2/main/unboundFunction?num=1&text=%27a%20b%2Fc%27");
    expect(response.body).toMatchObject({
      d: {
        unboundFunction: {
          age: 1,
          code: "TEST",
          name: "a b/c",
          __metadata: {
            type: "test.MainService.Result",
          },
        },
      },
    });
    response = await util.callRead(request, "/odata/v2/main/unboundFunction?num=1&text='abc'");
    expect(response.body).toMatchObject({
      d: {
        unboundFunction: {
          age: 1,
          code: "TEST",
          name: "abc",
          __metadata: {
            type: "test.MainService.Result",
          },
        },
      },
    });

    const _request = util.callRead(request, "/odata/v2/main/unboundFunction?num=1&text=abc");
    // Set wrong body for GET
    _request.set("content-type", "application/json").send({ code: "TEST" });
    response = await _request;
    expect(response.body).toMatchObject({
      d: {
        unboundFunction: {
          age: 1,
          code: "TEST",
          name: "abc",
          __metadata: {
            type: "test.MainService.Result",
          },
        },
      },
    });
  });

  it("GET unbound mass function", async () => {
    let response = await util.callRead(request, "/odata/v2/main/unboundMassFunction?ids=TEST1");
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            age: 0,
            code: "TEST1",
            name: "TEST1",
            __metadata: {
              type: "test.MainService.Result",
            },
          },
        ],
      },
    });
    response = await util.callRead(request, "/odata/v2/main/unboundMassFunction?ids=TEST1&ids='TEST2'");
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            age: 0,
            code: "TEST1",
            name: "TEST1",
            __metadata: {
              type: "test.MainService.Result",
            },
          },
          {
            age: 1,
            code: "TEST2",
            name: "TEST2",
            __metadata: {
              type: "test.MainService.Result",
            },
          },
        ],
      },
    });
    response = await util.callRead(request, "/odata/v2/main/unboundMassFunctionInline?ids=TEST1&ids='TEST2'");
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            age: 0,
            code: "TEST1",
            name: "TEST1",
            __metadata: {
              type: "test.MainService.return_test_MainService_unboundMassFunctionInline",
            },
          },
          {
            age: 1,
            code: "TEST2",
            name: "TEST2",
            __metadata: {
              type: "test.MainService.return_test_MainService_unboundMassFunctionInline",
            },
          },
        ],
      },
    });
  });

  it("GET unbound primitive function", async () => {
    let response = await util.callRead(request, "/odata/v2/main/unboundFunctionPrimitive?num=1");
    expect(response.body).toMatchObject({
      d: {
        unboundFunctionPrimitive: 1,
      },
    });
    response = await util.callRead(request, "/odata/v2/main/unboundMassFunctionPrimitive?text1=abc&text2=def");
    expect(response.body).toMatchObject({
      d: {
        results: ["abc", "def"],
      },
    });
  });

  it("GET unbound primitive string function", async () => {
    let response = await util.callRead(request, "/odata/v2/main/unboundFunctionPrimitiveString?text=abc");
    expect(response.body).toMatchObject({
      d: {
        unboundFunctionPrimitiveString: "abc",
      },
    });
    response = await util.callRead(request, "/odata/v2/main/unboundFunctionPrimitiveLargeString?text=abc");
    expect(response.body).toMatchObject({
      d: {
        unboundFunctionPrimitiveLargeString: "abc",
      },
    });
  });

  it("GET unbound entity function", async () => {
    let response = await util.callRead(request, "/odata/v2/main/unboundFunctionEntity?num=1&text=test");
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          type: "test.MainService.Header",
        },
        name: "TEST",
        description: "test",
        stock: 1,
        Items: {
          __deferred: {},
        },
      },
    });
    response = await util.callRead(request, "/odata/v2/main/unboundMassFunctionEntity?ids=TEST1&ids='TEST2'");
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            __metadata: {
              type: "test.MainService.Header",
            },
            name: "TEST1",
            description: "TEST1",
            stock: 0,
            Items: {
              __deferred: {},
            },
          },
          {
            __metadata: {
              type: "test.MainService.Header",
            },
            name: "TEST2",
            description: "TEST2",
            stock: 1,
            Items: {
              __deferred: {},
            },
          },
        ],
      },
    });
  });

  it("GET unbound decimal function", async () => {
    let response = await util.callRead(request, "/odata/v2/main/unboundDecimalFunction");
    expect(response.body).toMatchObject({
      d: {
        unboundDecimalFunction: "12345.6789",
      },
    });
    response = await util.callRead(request, "/odata/v2/main/unboundDecimalsFunction");
    expect(response.body).toMatchObject({
      d: {
        results: ["12345.6789", "12345.6789"],
      },
    });
  });

  it("GET unbound function error", async () => {
    let response = await util.callRead(request, "/odata/v2/main/unboundErrorFunction");
    expect(response.body).toMatchObject({
      error: {
        code: "ERR01",
        message: {
          lang: "en",
          value: "An error occurred",
        },
        target: "Header(ID=guid'1b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/name",
        additionalTargets: ["Header(ID=guid'1b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/description"],
        severity: "error",
        ContentID: "1",
        innererror: {
          errordetails: [
            {
              code: "ERR02-transition",
              message: "Error details",
              target:
                "Header(ID=guid'1b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/Items(ID=guid'2b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/description",
              additionalTargets: [
                "Header(ID=guid'1b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/Items(ID=guid'2b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/name",
              ],
              severity: "error",
              transition: true,
              ContentID: "1",
            },
          ],
        },
      },
    });
  });

  it("GET unbound function warning", async () => {
    let response = await util.callRead(request, "/odata/v2/main/unboundWarningFunction");
    expect(response.body).toMatchObject({
      d: {
        unboundWarningFunction: {
          age: 1,
          code: "TEST",
          name: "Test",
          __metadata: {
            type: "test.MainService.Result",
          },
        },
      },
    });
    expect(JSON.parse(response.headers["sap-message"])).toEqual({
      code: "WARN01",
      details: [
        {
          code: "WARN02",
          message: "Another Warning occurred",
          severity: expect.stringMatching(/info|warning/),
          target:
            "Header(ID=guid'1b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/Items(ID=guid'2b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/description",
          additionalTargets: [
            "Header(ID=guid'1b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/Items(ID=guid'2b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/name",
          ],
          ContentID: "2",
        },
      ],
      message: "An Warning occurred",
      severity: expect.stringMatching(/info|warning/),
      target: "Header(ID=guid'1b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/name",
      additionalTargets: ["Header(ID=guid'1b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/description"],
      ContentID: "1",
    });
  });

  it("GET unbound function escaped warning", async () => {
    let response = await util.callRead(request, "/odata/v2/main/unboundEscapedWarningFunction");
    expect(JSON.parse(response.headers["sap-message"])).toEqual({
      code: "WARN01",
      details: [],
      message: "Użytkownik",
      severity: "warning",
      target: "/#TRANSIENT#",
    });
  });

  it("GET unbound function with navigation", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
      Items: [
        {
          name: "TestItem",
        },
      ],
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    response = await util.callRead(request, `/odata/v2/main/unboundNavigationFunction?num=1&text=${id}`);
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          type: "test.MainService.Header",
          uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')`,
        },
        createdBy: "anonymous",
        modifiedBy: "anonymous",
        name: "Test",
        description: null,
      },
    });
    response = await util.callRead(request, "/odata/v2/main/unboundNavigationsFunction?num=1&text=abc");
    expect(response.body.d.results.length > 0).toEqual(true);
    response = await util.callRead(request, "/odata/v2/main/unboundNavigationFunction/Items?num=1&text=abc");
    expect(response.body).toMatchObject({
      error: {
        code: "400",
        message: {
          lang: "en",
          value: `Current function 'unboundNavigationFunction' is not composable; trailing segment 'Items' ist not allowed`,
        },
        severity: "error",
        innererror: {
          errordetails: [
            {
              code: "400",
              message: {
                lang: "en",
                value: `Current function 'unboundNavigationFunction' is not composable; trailing segment 'Items' ist not allowed`,
              },
              severity: "error",
            },
          ],
        },
      },
    });
  });

  it("GET bound function", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callRead(request, `/odata/v2/main/Header_boundFunction?ID=guid'${id}'&num=1&text=abc`);
    expect(response.body).toMatchObject({
      d: {
        Header_boundFunction: {
          age: 1,
          code: "TEST",
          name: "abc",
          __metadata: {
            type: "test.MainService.Result",
          },
        },
      },
    });
    response = await util.callRead(request, `/odata/v2/main/Header_boundFunction?ID=guid'${id}'&num=1&text=a%20b%2Fc`);
    expect(response.body).toMatchObject({
      d: {
        Header_boundFunction: {
          age: 1,
          code: "TEST",
          name: "a b/c",
          __metadata: {
            type: "test.MainService.Result",
          },
        },
      },
    });
  });

  it("GET bound mass function", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callRead(
      request,
      `/odata/v2/main/Header_boundMassFunction?ID=guid'${id}'&ids=TEST1&ids='TEST2'`,
    );
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            age: 0,
            code: "TEST1",
            name: "TEST1",
            __metadata: {
              type: "test.MainService.Result",
            },
          },
          {
            age: 1,
            code: "TEST2",
            name: "TEST2",
            __metadata: {
              type: "test.MainService.Result",
            },
          },
        ],
      },
    });
  });

  it("GET bound primitive function", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callRead(request, `/odata/v2/main/Header_boundFunctionPrimitive?ID=guid'${id}'&num=1`);
    expect(response.body).toMatchObject({
      d: {
        Header_boundFunctionPrimitive: 1,
      },
    });
    response = await util.callRead(
      request,
      `/odata/v2/main/Header_boundMassFunctionPrimitive?ID=guid'${id}'&text1=abc&text2=def`,
    );
    expect(response.body).toMatchObject({
      d: {
        results: ["abc", "def"],
      },
    });
  });

  it("GET bound primitive string function", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callRead(
      request,
      `/odata/v2/main/Header_boundFunctionPrimitiveString?ID=guid'${id}'&text=abc`,
    );
    expect(response.body).toMatchObject({
      d: {
        Header_boundFunctionPrimitiveString: "abc",
      },
    });
    response = response = await util.callRead(
      request,
      `/odata/v2/main/Header_boundFunctionPrimitiveLargeString?ID=guid'${id}'&text=abc`,
    );
    expect(response.body).toMatchObject({
      d: {
        Header_boundFunctionPrimitiveLargeString: "abc",
      },
    });
  });

  it("GET bound entity function", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callRead(request, `/odata/v2/main/Header_boundFunctionEntity?ID=guid'${id}'&num=1&text=test`);
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          type: "test.MainService.Header",
        },
        name: "TEST",
        description: "test",
        stock: 1,
        Items: {
          __deferred: {},
        },
      },
    });
    response = await util.callRead(
      request,
      `/odata/v2/main/Header_boundMassFunctionEntity?ID=guid'${id}'&ids=TEST1&ids='TEST2'`,
    );
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            __metadata: {
              type: "test.MainService.Header",
            },
            name: "TEST1",
            description: "TEST1",
            stock: 0,
            Items: {
              __deferred: {},
            },
          },
          {
            __metadata: {
              type: "test.MainService.Header",
            },
            name: "TEST2",
            description: "TEST2",
            stock: 1,
            Items: {
              __deferred: {},
            },
          },
        ],
      },
    });
  });

  it("GET bound function error", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callRead(request, `/odata/v2/main/Header_boundErrorFunction?ID=guid'${id}'`);
    expect(response.body).toMatchObject({
      error: {
        code: "ERR01",
        message: {
          lang: "en",
          value: "An error occurred",
        },
        target: `Header(ID=guid'${id}',IsActiveEntity=false)/name`,
        additionalTargets: [`Header(ID=guid'${id}',IsActiveEntity=false)/description`],
        severity: "error",
        ContentID: "1",
        innererror: {
          errordetails: [
            {
              code: "ERR02-transition",
              message: "Error details",
              target: "Items(ID=guid'2b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/description",
              additionalTargets: ["Items(ID=guid'2b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/name"],
              severity: "error",
              transition: true,
              ContentID: "1",
            },
          ],
        },
      },
    });
  });

  it("GET bound function warning", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callRead(request, `/odata/v2/main/Header_boundWarningFunction?ID=guid'${id}'`);
    expect(response.body).toMatchObject({
      d: {
        Header_boundWarningFunction: {
          age: 1,
          code: "TEST",
          name: "Test",
          __metadata: {
            type: "test.MainService.Result",
          },
        },
      },
    });
    expect(JSON.parse(response.headers["sap-message"])).toEqual({
      code: "WARN01",
      details: [
        {
          code: "WARN02",
          message: "Another Warning occurred",
          severity: expect.stringMatching(/info|warning/),
          target: "Items(ID=guid'2b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/description",
          additionalTargets: ["Items(ID=guid'2b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/name"],
          ContentID: "2",
        },
      ],
      message: "An Warning occurred",
      severity: expect.stringMatching(/info|warning/),
      target: `Header(ID=guid'${id}',IsActiveEntity=false)/name`,
      additionalTargets: [`Header(ID=guid'${id}',IsActiveEntity=false)/description`],
      ContentID: "1",
    });
  });

  it("POST unbound action", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/unboundAction?num=1&text=abc");
    expect(response.body).toMatchObject({
      d: {
        unboundAction: {
          age: 1,
          code: "TEST",
          name: "abc",
          __metadata: {
            type: "test.MainService.Result",
          },
        },
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/unboundActionInline?num=1&text=abc");
    expect(response.body).toMatchObject({
      d: {
        unboundActionInline: {
          age: 1,
          code: "TEST",
          name: "abc",
          __metadata: {
            type: "test.MainService.return_test_MainService_unboundActionInline",
          },
        },
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/unboundAction?num=1&text=a%20b%2Fc");
    expect(response.body).toMatchObject({
      d: {
        unboundAction: {
          age: 1,
          code: "TEST",
          name: "a b/c",
          __metadata: {
            type: "test.MainService.Result",
          },
        },
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/unboundAction", {
      num: 1,
      text: "abc",
    });
    expect(response.body).toMatchObject({
      d: {
        unboundAction: {
          age: 1,
          code: "TEST",
          name: "abc",
          __metadata: {
            type: "test.MainService.Result",
          },
        },
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/unboundAction?num=1", {
      text: "abc",
    });
    expect(response.body).toMatchObject({
      d: {
        unboundAction: {
          age: 1,
          code: "TEST",
          name: "abc",
          __metadata: {
            type: "test.MainService.Result",
          },
        },
      },
    });
  });

  it("POST unbound action request with sap-language", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/unboundAction?num=1&text=abc&sap-language=de");
    expect(response.body).toMatchObject({
      d: {
        unboundAction: {
          age: 1,
          code: "TEST",
          name: "abc",
          __metadata: {
            type: "test.MainService.Result",
          },
        },
      },
    });
  });

  it("POST unbound mass action", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/unboundMassAction?ids=TEST1");
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            age: 0,
            code: "TEST1",
            name: "TEST1",
            __metadata: {
              type: "test.MainService.Result",
            },
          },
        ],
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/unboundMassAction?ids=TEST1&ids='TEST2'");
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            age: 0,
            code: "TEST1",
            name: "TEST1",
            __metadata: {
              type: "test.MainService.Result",
            },
          },
          {
            age: 1,
            code: "TEST2",
            name: "TEST2",
            __metadata: {
              type: "test.MainService.Result",
            },
          },
        ],
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/unboundMassAction", { ids: ["TEST1", "TEST2"] });
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            age: 0,
            code: "TEST1",
            name: "TEST1",
            __metadata: {
              type: "test.MainService.Result",
            },
          },
          {
            age: 1,
            code: "TEST2",
            name: "TEST2",
            __metadata: {
              type: "test.MainService.Result",
            },
          },
        ],
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/unboundMassActionInline?ids=TEST1&ids='TEST2'");
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            age: 0,
            code: "TEST1",
            name: "TEST1",
            __metadata: {
              type: "test.MainService.return_test_MainService_unboundMassActionInline",
            },
          },
          {
            age: 1,
            code: "TEST2",
            name: "TEST2",
            __metadata: {
              type: "test.MainService.return_test_MainService_unboundMassActionInline",
            },
          },
        ],
      },
    });
  });

  it("POST unbound action request with no return", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/unboundActionNoReturn?num=1&text=abc");
    expect(response.body).toEqual({});
  });

  it("POST unbound primitive action", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/unboundActionPrimitive?num=1");
    expect(response.body).toMatchObject({
      d: {
        unboundActionPrimitive: 1,
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/unboundMassActionPrimitive?text1=abc&text2=def");
    expect(response.body).toMatchObject({
      d: {
        results: ["abc", "def"],
      },
    });
  });

  it("POST unbound primitive string action", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/unboundActionPrimitiveString?text=abc");
    expect(response.body).toMatchObject({
      d: {
        unboundActionPrimitiveString: "abc",
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/unboundActionPrimitiveLargeString?text=abc");
    expect(response.body).toMatchObject({
      d: {
        unboundActionPrimitiveLargeString: "abc",
      },
    });
  });

  it("POST unbound entity action", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/unboundActionEntity?num=1&text=test");
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          type: "test.MainService.Header",
        },
        name: "TEST",
        description: "test",
        stock: 1,
        Items: {
          __deferred: {},
        },
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/unboundMassActionEntity?ids=TEST1&ids='TEST2'");
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            __metadata: {
              type: "test.MainService.Header",
            },
            name: "TEST1",
            description: "TEST1",
            stock: 0,
            Items: {
              __deferred: {},
            },
          },
          {
            __metadata: {
              type: "test.MainService.Header",
            },
            name: "TEST2",
            description: "TEST2",
            stock: 1,
            Items: {
              __deferred: {},
            },
          },
        ],
      },
    });
  });

  it("POST unbound action error", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/unboundErrorAction?num=1&text=default");
    expect(response.body).toMatchObject({
      error: {
        code: "ERR01",
        message: {
          lang: "en",
          value: "An error occurred",
        },
        target: "name",
        severity: "error",
        ContentID: "1",
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/unboundErrorAction?num=1&text=unchecked");
    expect(response.body).toMatchObject({
      error: {
        code: "ERR01",
        message: {
          lang: "en",
          value: "An error occurred",
        },
        target: "_xXx123",
        severity: "error",
        ContentID: "1",
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/unboundErrorAction?num=1&text=relative");
    expect(response.body).toMatchObject({
      error: {
        code: "ERR01",
        message: {
          lang: "en",
          value: "An error occurred",
        },
        target: "Header(ID=guid'1b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/name",
        severity: "error",
        ContentID: "1",
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/unboundErrorAction?num=1&text=guid");
    expect(response.body).toMatchObject({
      error: {
        code: "ERR01",
        message: {
          lang: "en",
          value: "An error occurred",
        },
        target: "Header(ID=guid'1b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/name",
        severity: "error",
        ContentID: "1",
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/unboundErrorAction?num=1&text=absolute");
    expect(response.body).toMatchObject({
      error: {
        code: "ERR01",
        message: {
          lang: "en",
          value: "An error occurred",
        },
        target: "/Header(ID=guid'1b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/name",
        severity: "error",
        ContentID: "1",
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/unboundErrorAction?num=1&text=transient");
    expect(response.body).toMatchObject({
      error: {
        code: "ERR01",
        message: {
          lang: "en",
          value: "An error occurred",
        },
        target: "/#TRANSIENT#",
        severity: "error",
        ContentID: "1",
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/unboundErrorAction?num=1&text=transientpath");
    expect(response.body).toMatchObject({
      error: {
        code: "ERR01",
        message: {
          lang: "en",
          value: "An error occurred",
        },
        target: "/#TRANSIENT#/Header(ID=guid'1b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/name",
        severity: "error",
        ContentID: "1",
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/unboundErrorAction?num=1&text=invalid");
    expect(response.body).toMatchObject({
      error: {
        code: "ERR01",
        message: {
          lang: "en",
          value: "An error occurred",
        },
        target: "Header2(ID=1b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/name2",
        severity: "error",
        ContentID: "1",
      },
    });
  });

  it("POST bound action", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callWrite(request, `/odata/v2/main/Header_boundAction?ID=guid'${id}'&num=1&text=abc`);
    expect(response.body).toMatchObject({
      d: {
        Header_boundAction: {
          age: 1,
          code: "TEST",
          name: "abc",
          __metadata: {
            type: "test.MainService.Result",
          },
        },
      },
    });
    response = await util.callWrite(request, `/odata/v2/main/Header_boundActionInline?ID=guid'${id}'&num=1&text=abc`);
    expect(response.body).toMatchObject({
      d: {
        Header_boundActionInline: {
          age: 1,
          code: "TEST",
          name: "abc",
          __metadata: {
            type: "test.MainService.return_test_MainService_Header_boundActionInline",
          },
        },
      },
    });
    response = await util.callWrite(request, `/odata/v2/main/Header_boundAction?ID=guid'${id}'&num=1&text=a%20b%2Fc`);
    expect(response.body).toMatchObject({
      d: {
        Header_boundAction: {
          age: 1,
          code: "TEST",
          name: "a b/c",
          __metadata: {
            type: "test.MainService.Result",
          },
        },
      },
    });
  });

  it("POST bound primitive action", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callWrite(request, `/odata/v2/main/Header_boundActionPrimitive?ID=guid'${id}'&num=1`);
    expect(response.body).toMatchObject({
      d: {
        Header_boundActionPrimitive: 1,
      },
    });
    response = await util.callWrite(
      request,
      `/odata/v2/main/Header_boundMassActionPrimitive?ID=guid'${id}'&text1=abc&text2=def`,
    );
    expect(response.body).toMatchObject({
      d: {
        results: ["abc", "def"],
      },
    });
  });

  it("POST bound primitive string action", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callWrite(
      request,
      `/odata/v2/main/Header_boundActionPrimitiveString?ID=guid'${id}'&text=abc`,
    );
    expect(response.body).toMatchObject({
      d: {
        Header_boundActionPrimitiveString: "abc",
      },
    });
    response = await util.callWrite(
      request,
      `/odata/v2/main/Header_boundActionPrimitiveLargeString?ID=guid'${id}'&text=abc`,
    );
    expect(response.body).toMatchObject({
      d: {
        Header_boundActionPrimitiveLargeString: "abc",
      },
    });
  });

  it("POST bound mass action", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callWrite(request, `/odata/v2/main/Header_boundMassAction?ID=guid'${id}'&ids=TEST1`);
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            age: 0,
            code: "TEST1",
            name: "TEST1",
            __metadata: {
              type: "test.MainService.Result",
            },
          },
        ],
      },
    });
    response = await util.callWrite(
      request,
      `/odata/v2/main/Header_boundMassAction?ID=guid'${id}'&ids=TEST1&ids='TEST2'`,
    );
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            age: 0,
            code: "TEST1",
            name: "TEST1",
            __metadata: {
              type: "test.MainService.Result",
            },
          },
          {
            age: 1,
            code: "TEST2",
            name: "TEST2",
            __metadata: {
              type: "test.MainService.Result",
            },
          },
        ],
      },
    });
    response = await util.callWrite(
      request,
      `/odata/v2/main/Header_boundMassActionInline?ID=guid'${id}'&ids=TEST1&ids='TEST2'`,
    );
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            age: 0,
            code: "TEST1",
            name: "TEST1",
            __metadata: {
              type: "test.MainService.return_test_MainService_Header_boundMassActionInline",
            },
          },
          {
            age: 1,
            code: "TEST2",
            name: "TEST2",
            __metadata: {
              type: "test.MainService.return_test_MainService_Header_boundMassActionInline",
            },
          },
        ],
      },
    });
  });

  it("POST bound action request with no return", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callWrite(request, `/odata/v2/main/Header_boundActionNoReturn?ID=guid'${id}'&num=1&text=abc`);
    expect(response.body).toEqual({});
  });

  it("POST bound entity action", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callWrite(request, `/odata/v2/main/Header_boundActionEntity?ID=guid'${id}'&num=1&text=test`);
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          type: "test.MainService.Header",
        },
        name: "TEST",
        description: "test",
        stock: 1,
        Items: {
          __deferred: {},
        },
      },
    });
    response = await util.callWrite(
      request,
      `/odata/v2/main/Header_boundMassActionEntity?ID=guid'${id}'&ids=TEST1&ids='TEST2'`,
    );
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            __metadata: {
              type: "test.MainService.Header",
            },
            name: "TEST1",
            description: "TEST1",
            stock: 0,
            Items: {
              __deferred: {},
            },
          },
          {
            __metadata: {
              type: "test.MainService.Header",
            },
            name: "TEST2",
            description: "TEST2",
            stock: 1,
            Items: {
              __deferred: {},
            },
          },
        ],
      },
    });
  });

  it("GET HANA SYSUUID as ID", async () => {
    const ID = "D99B1B70-3B03-BC1E-1700-05023630F1F7";
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      ID,
    });
    expect(response.statusCode).toEqual(201);
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${ID}')`);
    expect(response.body && response.body.d).toBeDefined();
    expect(response.body.d).toEqual(
      expect.objectContaining({
        ID,
      }),
    );
  });

  it("Entity with key including reserved/escaped uri characters", async () => {
    let response = await util.callRead(request, "/odata/v2/main/Favorite");
    expect(response.statusCode).toEqual(200);
    expect(response.body && response.body.d && response.body.d.results).toBeDefined();
    response.body.d.results.forEach((result) => {
      result.__metadata.uri = result.__metadata.uri.substr(
        `http://${response.request.host.replace("127.0.0.1", "localhost")}`.length,
      );
    });
    expect(response.body && response.body.d).toMatchSnapshot();

    const uris = response.body.d.results.map((result) => {
      return result.__metadata.uri.substr();
    });

    await uris.reduce(async (promise, uri) => {
      await promise;

      response = await util.callRead(request, uri);
      expect(uri + ":" + response.statusCode).toEqual(uri + ":" + 200);
      expect(response.body && response.body.d).toBeDefined();
      let data = response.body && response.body.d;
      data.__metadata.uri = data.__metadata.uri.substr(
        `http://${response.request.host.replace("127.0.0.1", "localhost")}`.length,
      );
      const id = data.__metadata.uri.substring(
        data.__metadata.uri.indexOf("'") + 1,
        data.__metadata.uri.lastIndexOf("'"),
      );
      let name = decodeURIComponent(id);
      name = name.replace(/''/g, "'");
      let value = name.substr(2, 1);
      // Special handling
      value = value === "\\" ? "\\\\" : value;
      expect(data).toEqual({
        __metadata: {
          type: "test.MainService.Favorite",
          uri: uri,
        },
        name,
        value,
      });

      response = await util.callRead(request, `/odata/v2/main/Favorite?$filter=name eq '${id}'`);
      expect(response.statusCode).toEqual(200);
      data = response.body && response.body.d && response.body.d.results && response.body.d.results[0];
      data.__metadata.uri = data.__metadata.uri.substr(
        `http://${response.request.host.replace("127.0.0.1", "localhost")}`.length,
      );
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
    let response = await util.callRead(request, "/odata/v2/main/StringUUID");
    expect(response.statusCode).toEqual(200);
    expect(response.body && response.body.d && response.body.d.results).toBeDefined();
    response.body.d.results.forEach((result) => {
      result.__metadata.uri = result.__metadata.uri.substr(
        `http://${response.request.host.replace("127.0.0.1", "localhost")}`.length,
      );
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

  it("GET with x-forwarded headers", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.statusCode).toEqual(201);
    let id = response.body.d.ID;
    response = await util.callRead(request, `/odata/v2/main/Header(ID=guid'${id}')`, {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "test:1234",
      "x-forwarded-path": `/xyz/odata/v2/main/Header(ID=guid'${id}')`,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body.d).toMatchObject({
      name: "Test",
      __metadata: {
        type: "test.MainService.Header",
        uri: `https://test:1234/xyz/odata/v2/main/Header(guid'${id}')`,
      },
    });
    response = await util.callRead(request, `/odata/v2/main/Header(ID=guid'${id}')`, {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "test:1234",
      "x-forwarded-path": `/abc/v3/Header(ID=guid'${id}')/toRootHeader`,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body.d).toMatchObject({
      name: "Test",
      __metadata: {
        type: "test.MainService.Header",
        uri: `https://test:1234/abc/v3/Header(guid'${id}')`,
      },
    });
    response = await util.callRead(request, `/odata/v2/main/Header(ID=guid'${id}')`, {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "test:1234",
      "x-forwarded-path": `/cockpit/Header(ID=guid'${id}')`,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body.d).toMatchObject({
      name: "Test",
      __metadata: {
        type: "test.MainService.Header",
        uri: `https://test:1234/cockpit/Header(guid'${id}')`,
      },
    });
    response = await util.callRead(request, `/odata/v2/main/Header(ID=guid'${id}')`, {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "test:1234",
      "x-forwarded-path": `/cockpit/odata/v2/Header(ID=guid'${id}')`,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body.d).toMatchObject({
      name: "Test",
      __metadata: {
        type: "test.MainService.Header",
        uri: `https://test:1234/cockpit/odata/v2/Header(guid'${id}')`,
      },
    });
    response = await util.callRead(request, `/odata/v2/main/Header(ID=guid'${id}')`, {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "test:1234",
      "x-forwarded-path": `https://test:1234/cockpit/odata/v2/Header(ID=guid'${id}')`,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body.d).toMatchObject({
      name: "Test",
      __metadata: {
        type: "test.MainService.Header",
        uri: `https://test:1234/cockpit/odata/v2/Header(guid'${id}')`,
      },
    });
    response = await util.callRead(request, "/odata/v2/main/Header", {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "test:1234",
      "x-forwarded-path": `/cockpit/odata/v2/Header`,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body.d.results.length > 0).toEqual(true);
    expect(response.body.d.results[0]).toMatchObject({
      __metadata: {
        type: "test.MainService.Header",
        uri: `https://test:1234/cockpit/odata/v2/Header(guid'${response.body.d.results[0].ID}')`,
      },
    });
    response = await util.callRead(request, "/odata/v2/main/Header?a=b", {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "test:1234",
      "x-forwarded-path": `/cockpit/odata/v2/Header?a=b`,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body.d.results.length > 0).toEqual(true);
    expect(response.body.d.results[0]).toMatchObject({
      __metadata: {
        type: "test.MainService.Header",
        uri: `https://test:1234/cockpit/odata/v2/Header(guid'${response.body.d.results[0].ID}')`,
      },
    });
    response = await util.callRead(request, `/odata/v2/main/unboundNavigationFunction?num=1&text=${id}`, {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "test:1234",
      "x-forwarded-path": `/cockpit/unboundNavigationFunction?num=1&text=${id}`,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body.d).toMatchObject({
      __metadata: {
        type: "test.MainService.Header",
        uri: `https://test:1234/cockpit/Header(guid'${response.body.d.ID}')`,
      },
    });
    response = await util.callRead(request, `/odata/v2/main/unboundNavigationFunction?num=1&text=${id}`, {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "test:1234",
      "x-forwarded-path": `/cockpit/odata/v2/unboundNavigationFunction?num=1&text=${id}`,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body.d).toMatchObject({
      __metadata: {
        type: "test.MainService.Header",
        uri: `https://test:1234/cockpit/odata/v2/Header(guid'${response.body.d.ID}')`,
      },
    });
    response = await util.callRead(request, `/odata/v2/main/Header_boundFunction?ID=guid'${id}'&num=1&text=abc`, {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "test:1234",
      "x-forwarded-path": `/cockpit/odata/v2/Header_boundFunction?ID=guid'${id}'&num=1&text=abc`,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body).toMatchObject({
      d: {
        Header_boundFunction: {
          age: 1,
          code: "TEST",
          name: "abc",
          __metadata: {
            type: "test.MainService.Result",
          },
        },
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/HeaderDelta", {
      name: "Test",
    });
    expect(response.statusCode).toEqual(201);
    id = response.body.d.ID;
    response = await util.callRead(request, `/odata/v2/main/HeaderDelta?!deltatoken='${new Date().getTime()}'`, {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "test:1234",
      "x-forwarded-path": `/cockpit/HeaderDelta?!deltatoken='${new Date().getTime()}'`,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body.d.results).toBeDefined();
    expect(response.body.d.__delta).toMatch(/https:\/\/test:1234\/cockpit\/HeaderDelta\?!deltatoken='(\d*)'/);
    response = await util.callRead(request, `/odata/v2/main/HeaderDelta(guid'${id}')`);
    expect(response.statusCode).toEqual(200);
    expect(response.body.d.results).toBeUndefined();
    response = await util.callRead(request, "/odata/v2/main/$metadata", {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "test:1234",
      "x-forwarded-path": "/cockpit",
    });
    expect(response.statusCode).toEqual(200);
    response = await util.callRead(request, "/odata/v2/main", {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "test:1234",
      "x-forwarded-path": "/cockpit",
    });
    expect(response.statusCode).toEqual(200);
    expect(response.text).toMatch(/https:\/\/test:1234\/cockpit/);
    expect(response.text).not.toMatch(/v2\/main/);
    response = await util.callRead(request, "/odata/v2/main/", {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "test:1234",
      "x-forwarded-path": "/cockpit/",
    });
    expect(response.statusCode).toEqual(200);
    expect(response.text).toMatch(/https:\/\/test:1234\/cockpit/);
    expect(response.text).not.toMatch(/v2\/main/);
    response = await util.callRead(request, "/odata/v2/main/", {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "test:1234",
      "x-forwarded-path": "/",
    });
    expect(response.statusCode).toEqual(200);
    expect(response.text).toMatch(/https:\/\/test:1234/);
    expect(response.text).not.toMatch(/v2\/main/);
    response = await util.callRead(request, "/odata/v2/main", {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "test:1234",
      "x-forwarded-path": "",
    });
    expect(response.statusCode).toEqual(200);
    expect(response.text).toMatch(/https:\/\/test:1234/);
    expect(response.text).not.toMatch(/v2\/main/);
    response = await util.callRead(request, "/odata/v2/main/", {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "test:1234",
    });
    expect(response.statusCode).toEqual(200);
    expect(response.text).toMatch(/https:\/\/test:1234\/odata\/v2\/main/);
    expect(response.text).not.toMatch(/cockpit/);
  });

  it("Entity with umlauts", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Schöne Träume",
    });
    expect(response.body).toBeDefined();
    expect(response.body.d.name).toEqual("Schöne Träume");
    const id = response.body.d.ID;
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${id}')`);
    expect(response.body.d.name).toEqual("Schöne Träume");
  });

  it("GET request with key of type large string", async () => {
    let response = await util.callRead(request, "/odata/v2/main/HeaderLargeString");
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(2);
    expect(response.body.d.results).toEqual([
      {
        Items: {
          __deferred: {
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost",
            )}/odata/v2/main/HeaderLargeString(name='A',country='DE')/Items`,
          },
        },
        __metadata: {
          type: "test.MainService.HeaderLargeString",
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost",
          )}/odata/v2/main/HeaderLargeString(name='A',country='DE')`,
        },
        country: "DE",
        currency: "EUR",
        name: "A",
        stock: 10,
      },
      {
        Items: {
          __deferred: {
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost",
            )}/odata/v2/main/HeaderLargeString(name='B',country='US')/Items`,
          },
        },
        __metadata: {
          type: "test.MainService.HeaderLargeString",
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost",
          )}/odata/v2/main/HeaderLargeString(name='B',country='US')`,
        },
        country: "US",
        currency: "USD",
        name: "B",
        stock: 11,
      },
    ]);
    response = await util.callRead(request, "/odata/v2/main/HeaderLargeString(name='A',country='DE')");
    expect(response.body.d).toEqual({
      Items: {
        __deferred: {
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost",
          )}/odata/v2/main/HeaderLargeString(name='A',country='DE')/Items`,
        },
      },
      __metadata: {
        type: "test.MainService.HeaderLargeString",
        uri: `http://${response.request.host.replace(
          "127.0.0.1",
          "localhost",
        )}/odata/v2/main/HeaderLargeString(name='A',country='DE')`,
      },
      country: "DE",
      currency: "EUR",
      name: "A",
      stock: 10,
    });
    response = await util.callRead(request, "/odata/v2/main/HeaderLargeString(name='A',country='DE')/Items");
    expect(response.body.d.results).toEqual([
      {
        __metadata: {
          type: "test.MainService.HeaderItemLargeString",
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost",
          )}/odata/v2/main/HeaderItemLargeString(name='a',position='1')`,
        },
        header: {
          __deferred: {
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost",
            )}/odata/v2/main/HeaderItemLargeString(name='a',position='1')/header`,
          },
        },
        header_country: "DE",
        header_name: "A",
        name: "a",
        position: "1",
        value: 8,
      },
      {
        __metadata: {
          type: "test.MainService.HeaderItemLargeString",
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost",
          )}/odata/v2/main/HeaderItemLargeString(name='a',position='2')`,
        },
        header: {
          __deferred: {
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost",
            )}/odata/v2/main/HeaderItemLargeString(name='a',position='2')/header`,
          },
        },
        header_country: "DE",
        header_name: "A",
        name: "a",
        position: "2",
        value: 9,
      },
    ]);
  });

  it("Double quotes in entity data", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "'",
    });
    expect(response.statusCode).toEqual(201);
    let ID = response.body.d.ID;
    response = await util.callRead(request, "/odata/v2/main/Header?$filter=name eq ''''");
    expect(response.body).toBeDefined();
    expect(response.body.d.results[0]).toMatchObject({ ID });
    response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "test'test",
    });
    expect(response.statusCode).toEqual(201);
    ID = response.body.d.ID;
    response = await util.callRead(request, "/odata/v2/main/Header?$filter=name eq 'test''test'");
    expect(response.body).toBeDefined();
    expect(response.body.d.results[0]).toMatchObject({ ID });
    response = await util.callWrite(request, "/odata/v2/main/unboundAction?num=1&text=abc'def");
    expect(response.body).toMatchObject({
      d: {
        unboundAction: {
          age: 1,
          code: "TEST",
          name: "abc'def",
          __metadata: {
            type: "test.MainService.Result",
          },
        },
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/unboundAction?num=1&text='test''test'");
    expect(response.body).toMatchObject({
      d: {
        unboundAction: {
          age: 1,
          code: "TEST",
          name: "test'test",
          __metadata: {
            type: "test.MainService.Result",
          },
        },
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/unboundAction?num=1&text=''''");
    expect(response.body).toMatchObject({
      d: {
        unboundAction: {
          age: 1,
          code: "TEST",
          name: "'",
          __metadata: {
            type: "test.MainService.Result",
          },
        },
      },
    });
  });

  it("POST action with linebreak in parameter exceeding max length", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/unboundActionMaxLength?&text=0123456789");
    expect(response.statusCode).toEqual(200);
    expect(response.body).toMatchObject({
      d: {
        unboundActionMaxLength: "0123456789",
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/unboundActionMaxLength?&text='0123456789'");
    expect(response.statusCode).toEqual(200);
    expect(response.body).toMatchObject({
      d: {
        unboundActionMaxLength: "0123456789",
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/unboundActionMaxLength?&text=0123456789a");
    expect(response.statusCode).toEqual(400);
    expect(response.body).toMatchObject({
      error: {
        code: "400",
        message: {
          lang: "en",
          value: expect.stringMatching(
            /Deserialization Error: Invalid value 0123456789a \((?:JavaScript )?string\) for property \\?"text\\?"\. The length of the Edm\.String value must not be greater than the MaxLength facet value \(10\)\./,
          ),
        },
        severity: "error",
        target: "/#TRANSIENT#",
        innererror: {
          errordetails: [
            {
              code: "400",
              message: {
                lang: "en",
                value: expect.stringMatching(
                  /Deserialization Error: Invalid value 0123456789a \((?:JavaScript )?string\) for property \\?"text\\?"\. The length of the Edm\.String value must not be greater than the MaxLength facet value \(10\)\./,
                ),
              },
              severity: "error",
              target: "/#TRANSIENT#",
            },
          ],
        },
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/unboundActionMaxLength?&text='0123456789a'");
    expect(response.statusCode).toEqual(400);
    expect(response.body).toMatchObject({
      error: {
        code: "400",
        message: {
          lang: "en",
          value: expect.stringMatching(
            /Deserialization Error: Invalid value 0123456789a \((?:JavaScript )?string\) for property \\?"text\\?"\. The length of the Edm\.String value must not be greater than the MaxLength facet value \(10\)\./,
          ),
        },
        severity: "error",
        target: "/#TRANSIENT#",
        innererror: {
          errordetails: [
            {
              code: "400",
              message: {
                lang: "en",
                value: expect.stringMatching(
                  /Deserialization Error: Invalid value 0123456789a \((?:JavaScript )?string\) for property \\?"text\\?"\. The length of the Edm\.String value must not be greater than the MaxLength facet value \(10\)\./,
                ),
              },
              severity: "error",
              target: "/#TRANSIENT#",
            },
          ],
        },
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/unboundActionMaxLength?&text=01234%0A5678");
    expect(response.statusCode).toEqual(200);
    expect(response.body).toMatchObject({
      d: {
        unboundActionMaxLength: "01234\n5678",
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/unboundActionMaxLength?&text='01234%0A5678'");
    expect(response.statusCode).toEqual(200);
    expect(response.body).toMatchObject({
      d: {
        unboundActionMaxLength: "01234\n5678",
      },
    });
    response = await util.callWrite(request, `/odata/v2/main/unboundActionMaxLength?&text="01234%0A5678"`);
    expect(response.statusCode).toEqual(400);
    expect(response.body).toMatchObject({
      error: {
        code: "400",
        message: {
          lang: "en",
          value: expect.stringMatching(
            /Deserialization Error: Invalid value "01234\n5678" \((?:JavaScript )?string\) for property \\?"text\\?"\. The length of the Edm\.String value must not be greater than the MaxLength facet value \(10\)\./,
          ),
        },
        severity: "error",
        target: "/#TRANSIENT#",
        innererror: {
          errordetails: [
            {
              code: "400",
              message: {
                lang: "en",
                value: expect.stringMatching(
                  /Deserialization Error: Invalid value "01234\n5678" \((?:JavaScript )?string\) for property \\?"text\\?"\. The length of the Edm\.String value must not be greater than the MaxLength facet value \(10\)\./,
                ),
              },
              severity: "error",
              target: "/#TRANSIENT#",
            },
          ],
        },
      },
    });
    response = await util.callWrite(request, "/odata/v2/main/unboundActionMaxLength?&text='01234%0A56789'");
    expect(response.statusCode).toEqual(400);
    expect(response.body).toMatchObject({
      error: {
        code: "400",
        message: {
          lang: "en",
          value: expect.stringMatching(
            /Deserialization Error: Invalid value 01234\n56789 \((?:JavaScript )?string\) for property \\?"text\\?"\. The length of the Edm\.String value must not be greater than the MaxLength facet value \(10\)\./,
          ),
        },
        severity: "error",
        target: "/#TRANSIENT#",
        innererror: {
          errordetails: [
            {
              code: "400",
              message: {
                lang: "en",
                value: expect.stringMatching(
                  /Deserialization Error: Invalid value 01234\n56789 \((?:JavaScript )?string\) for property \\?"text\\?"\. The length of the Edm\.String value must not be greater than the MaxLength facet value \(10\)\./,
                ),
              },
              severity: "error",
              target: "/#TRANSIENT#",
            },
          ],
        },
      },
    });
    response = await util.callWrite(request, `/odata/v2/main/unboundActionMaxLength?&text='"'`);
    expect(response.statusCode).toEqual(200);
    expect(response.body).toMatchObject({
      d: {
        unboundActionMaxLength: '"',
      },
    });
    response = await util.callWrite(request, `/odata/v2/main/unboundActionMaxLength?&text='""""""""""'`);
    expect(response.statusCode).toEqual(200);
    expect(response.body).toMatchObject({
      d: {
        unboundActionMaxLength: '""""""""""',
      },
    });
    response = await util.callWrite(request, `/odata/v2/main/unboundActionMaxLength?&text=""""""""""`);
    expect(response.statusCode).toEqual(200);
    expect(response.body).toMatchObject({
      d: {
        unboundActionMaxLength: '""""""""""',
      },
    });
    response = await util.callWrite(request, `/odata/v2/main/unboundActionMaxLength?&text='""""%0A"""""'`);
    expect(response.statusCode).toEqual(200);
    expect(response.body).toMatchObject({
      d: {
        unboundActionMaxLength: '""""\n"""""',
      },
    });
    response = await util.callWrite(request, `/odata/v2/main/unboundActionMaxLength?&text='"""""%0A"""""'`);
    expect(response.statusCode).toEqual(400);
    expect(response.body).toMatchObject({
      error: {
        code: "400",
        message: {
          lang: "en",
          value: expect.stringMatching(
            /Deserialization Error: Invalid value """""\n""""" \((?:JavaScript )?string\) for property \\?"text\\?"\. The length of the Edm\.String value must not be greater than the MaxLength facet value \(10\)\./,
          ),
        },
        severity: "error",
        target: "/#TRANSIENT#",
        innererror: {
          errordetails: [
            {
              code: "400",
              message: {
                lang: "en",
                value: expect.stringMatching(
                  /Deserialization Error: Invalid value """""\n""""" \((?:JavaScript )?string\) for property \\?"text\\?"\. The length of the Edm\.String value must not be greater than the MaxLength facet value \(10\)\./,
                ),
              },
              severity: "error",
              target: "/#TRANSIENT#",
            },
          ],
        },
      },
    });
  });

  it("GET calc decimal function", async () => {
    let response = await util.callRead(request, "/odata/v2/main/calcDecimal?value=1000&percentage=5");
    expect(response.body).toMatchObject({
      d: {
        calcDecimal: "50",
      },
    });
    response = await util.callRead(request, "/odata/v2/main/calcDecimal?value=1000&percentage=0");
    expect(response.body).toMatchObject({
      d: {
        calcDecimal: "0",
      },
    });
  });

  it("GET service entity with scoped name", async () => {
    let response = await util.callRead(request, "/odata/v2/main/context_Name_space_v2");
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            ID: "36a0b287-eae5-46f7-80a8-f3eb2f9bb328",
            name: "Test",
            __metadata: {
              type: "test.MainService.context_Name_space_v2",
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost",
              )}/odata/v2/main/context_Name_space_v2(guid'36a0b287-eae5-46f7-80a8-f3eb2f9bb328')`,
            },
          },
        ],
      },
    });
    response = await util.callRead(
      request,
      "/odata/v2/main/context_Name_space_v2(guid'36a0b287-eae5-46f7-80a8-f3eb2f9bb328')",
    );
    expect(response.body).toMatchObject({
      d: {
        ID: "36a0b287-eae5-46f7-80a8-f3eb2f9bb328",
        name: "Test",
        __metadata: {
          type: "test.MainService.context_Name_space_v2",
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost",
          )}/odata/v2/main/context_Name_space_v2(guid'36a0b287-eae5-46f7-80a8-f3eb2f9bb328')`,
        },
      },
    });
  });

  it("GET localized service entity", async () => {
    let response = await util.callRead(request, "/odata/v2/main/LocalizedEntity");
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            ID: "36a0b287-eae5-46f7-80a8-f3eb2f9bb328",
            name: "Test-DE",
            texts: {
              __deferred: {
                uri: `http://${response.request.host.replace(
                  "127.0.0.1",
                  "localhost",
                )}/odata/v2/main/LocalizedEntity(guid'36a0b287-eae5-46f7-80a8-f3eb2f9bb328')/texts`,
              },
            },
            localized: {
              __deferred: {
                uri: `http://${response.request.host.replace(
                  "127.0.0.1",
                  "localhost",
                )}/odata/v2/main/LocalizedEntity(guid'36a0b287-eae5-46f7-80a8-f3eb2f9bb328')/localized`,
              },
            },
            __metadata: {
              type: "test.MainService.LocalizedEntity",
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost",
              )}/odata/v2/main/LocalizedEntity(guid'36a0b287-eae5-46f7-80a8-f3eb2f9bb328')`,
            },
          },
        ],
      },
    });
    const id = response.body.d.results[0].ID;
    response = await util.callRead(request, `/odata/v2/main/LocalizedEntity(guid'${id}')`);
    expect(response.body).toMatchObject({
      d: {
        ID: "36a0b287-eae5-46f7-80a8-f3eb2f9bb328",
        name: "Test-DE",
        texts: {
          __deferred: {
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost",
            )}/odata/v2/main/LocalizedEntity(guid'36a0b287-eae5-46f7-80a8-f3eb2f9bb328')/texts`,
          },
        },
        localized: {
          __deferred: {
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost",
            )}/odata/v2/main/LocalizedEntity(guid'36a0b287-eae5-46f7-80a8-f3eb2f9bb328')/localized`,
          },
        },
        __metadata: {
          type: "test.MainService.LocalizedEntity",
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost",
          )}/odata/v2/main/LocalizedEntity(guid'36a0b287-eae5-46f7-80a8-f3eb2f9bb328')`,
        },
      },
    });
    response = await util.callRead(request, `/odata/v2/main/LocalizedEntity(guid'${id}')/texts`);
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            locale: "en",
            ID: "36a0b287-eae5-46f7-80a8-f3eb2f9bb328",
            name: "Test-DE",
            __metadata: {
              type: "test.MainService.LocalizedEntity_texts",
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost",
              )}/odata/v2/main/LocalizedEntity_texts(locale='en',ID=guid'36a0b287-eae5-46f7-80a8-f3eb2f9bb328')`,
            },
          },
        ],
      },
    });
    response = await util.callRead(
      request,
      "/odata/v2/main/LocalizedEntity_texts(locale='en',ID=guid'36a0b287-eae5-46f7-80a8-f3eb2f9bb328')",
    );
    expect(response.statusCode).toEqual(405);
    expect(response.body).toMatchObject({
      error: {
        code: "405",
        message: {
          lang: "en",
          value: 'Entity "test.MainService.LocalizedEntity_texts" is not explicitly exposed as part of the service',
        },
        severity: "error",
        target: "/#TRANSIENT#",
        innererror: {
          errordetails: [
            {
              code: "405",
              message: {
                lang: "en",
                value:
                  'Entity "test.MainService.LocalizedEntity_texts" is not explicitly exposed as part of the service',
              },
              severity: "error",
              target: "/#TRANSIENT#",
            },
          ],
        },
      },
    });
  });

  it("GET localized service entity with scoped name", async () => {
    let response = await util.callRead(request, "/odata/v2/main/context_LocalizedEntity");
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            ID: "36a0b287-eae5-46f7-80a8-f3eb2f9bb328",
            name: "Test-DE",
            texts: {
              __deferred: {
                uri: `http://${response.request.host.replace(
                  "127.0.0.1",
                  "localhost",
                )}/odata/v2/main/context_LocalizedEntity(guid'36a0b287-eae5-46f7-80a8-f3eb2f9bb328')/texts`,
              },
            },
            localized: {
              __deferred: {
                uri: `http://${response.request.host.replace(
                  "127.0.0.1",
                  "localhost",
                )}/odata/v2/main/context_LocalizedEntity(guid'36a0b287-eae5-46f7-80a8-f3eb2f9bb328')/localized`,
              },
            },
            __metadata: {
              type: "test.MainService.context_LocalizedEntity",
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost",
              )}/odata/v2/main/context_LocalizedEntity(guid'36a0b287-eae5-46f7-80a8-f3eb2f9bb328')`,
            },
          },
        ],
      },
    });
    const id = response.body.d.results[0].ID;
    response = await util.callRead(request, `/odata/v2/main/context_LocalizedEntity(guid'${id}')`);
    expect(response.body).toMatchObject({
      d: {
        ID: "36a0b287-eae5-46f7-80a8-f3eb2f9bb328",
        name: "Test-DE",
        texts: {
          __deferred: {
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost",
            )}/odata/v2/main/context_LocalizedEntity(guid'36a0b287-eae5-46f7-80a8-f3eb2f9bb328')/texts`,
          },
        },
        localized: {
          __deferred: {
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost",
            )}/odata/v2/main/context_LocalizedEntity(guid'36a0b287-eae5-46f7-80a8-f3eb2f9bb328')/localized`,
          },
        },
        __metadata: {
          type: "test.MainService.context_LocalizedEntity",
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost",
          )}/odata/v2/main/context_LocalizedEntity(guid'36a0b287-eae5-46f7-80a8-f3eb2f9bb328')`,
        },
      },
    });
    response = await util.callRead(request, `/odata/v2/main/context_LocalizedEntity(guid'${id}')/texts`);
    expect(response.body).toMatchObject({
      d: {
        results: [
          {
            locale: "en",
            ID: "36a0b287-eae5-46f7-80a8-f3eb2f9bb328",
            name: "Test-DE",
            __metadata: {
              type: "test.MainService.context_LocalizedEntity_texts",
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost",
              )}/odata/v2/main/context_LocalizedEntity_texts(locale='en',ID=guid'36a0b287-eae5-46f7-80a8-f3eb2f9bb328')`,
            },
          },
        ],
      },
    });
    response = await util.callRead(
      request,
      "/odata/v2/main/context_LocalizedEntity_texts(locale='en',ID=guid'36a0b287-eae5-46f7-80a8-f3eb2f9bb328')",
    );
    expect(response.body).toMatchObject({
      d: {
        locale: "en",
        ID: "36a0b287-eae5-46f7-80a8-f3eb2f9bb328",
        name: "Test-DE",
        __metadata: {
          type: "test.MainService.context_LocalizedEntity_texts",
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost",
          )}/odata/v2/main/context_LocalizedEntity_texts(locale='en',ID=guid'36a0b287-eae5-46f7-80a8-f3eb2f9bb328')`,
        },
      },
    });
  });

  // TODO: Enable Test (CAP #12350)
  it.skip("GET unbound service action with scoped name", async () => {
    const response = await util.callWrite(request, "/odata/v2/main/c?num=1&text=abc");
    expect(response.body).toMatchObject({
      d: {
        unbound_Action: {
          age: 1,
          code: "TEST",
          name: "abc",
          __metadata: {
            type: "test.MainService.Result",
          },
        },
      },
    });
  });

  // TODO: Enable Test (CAP #12350)
  it.skip("GET unbound service function with scoped name", async () => {
    const response = await util.callRead(request, "/odata/v2/main/unbound_Function?num=1&text=abc");
    expect(response.body).toMatchObject({
      d: {
        unbound_Function: {
          age: 1,
          code: "TEST",
          name: "abc",
          __metadata: {
            type: "test.MainService.Result",
          },
        },
      },
    });
  });

  it("POST bound action with composite key", async () => {
    let response = await util.callRead(request, "/odata/v2/main/Book(author='Catweazle',genre_ID=1)");
    expect(response.body).toBeDefined();
    expect(response.body.d.author).toEqual("Catweazle");
    expect(response.body.d.genre_ID).toEqual(1);
    response = await util.callWrite(request, `/odata/v2/main/Book_order?author='Catweazle'&genre_ID=1&number=5`);
    expect(response.body.d).toMatchObject({
      author: "Catweazle",
      genre_ID: 1,
      stock: 5,
      __metadata: {
        type: "test.MainService.Book",
        uri: `http://${response.request.host.replace(
          "127.0.0.1",
          "localhost",
        )}/odata/v2/main/Book(author='Catweazle',genre_ID=1)`,
      },
    });
    response = await util.callWrite(request, `/odata/v2/main/Book_order2?author='Catweazle'&genre_ID=1&number=5`);
    expect(response.body.d).toMatchObject({
      author: "Catweazle|Catweazle",
      genre_ID: 1,
      stock: 5,
      __metadata: {
        type: "test.MainService.Book",
        uri: `http://${response.request.host.replace(
          "127.0.0.1",
          "localhost",
        )}/odata/v2/main/Book(author='Catweazle%7CCatweazle',genre_ID=1)`,
      },
    });
  });

  it("POST bound action with whitespace entity key", async () => {
    let response = await util.callWrite(request, `/odata/v2/main/Book_order?author='Cat weazle'&genre_ID=1&number=5`);
    expect(response.body.d).toMatchObject({
      author: "Cat weazle",
      genre_ID: 1,
      stock: 5,
      __metadata: {
        type: "test.MainService.Book",
        uri: `http://${response.request.host.replace(
          "127.0.0.1",
          "localhost",
        )}/odata/v2/main/Book(author='Cat%20weazle',genre_ID=1)`,
      },
    });
  });

  it("GET entity with array structures", async () => {
    let response = await util.callRead(request, `/odata/v2/main/HeaderStructure`);
    expect(response.body.d.results).toMatchObject([
      {
        ID: "36a0b287-eae5-46f7-80a8-f3eb2f9bb328",
        date: "/Date(1681819200000+0000)/",
        // cds.odata.structs: false
        step_quantity: 1,
        step_startDate: "/Date(1681819200000+0000)/",
        step_endDate: "/Date(1681819200000+0000)/",
        // cds.odata.structs: true
        /*step: {
          quantity: 1,
          startDate: "/Date(1681819200000+0000)/",
          endDate: "/Date(1681819200000+0000)/"
        },*/
        phases: [
          {
            quantity: 1,
            startDate: "/Date(1681819200000+0000)/",
            endDate: "/Date(1681819200000+0000)/",
          },
        ],
        __metadata: {
          type: "test.MainService.HeaderStructure",
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost",
          )}/odata/v2/main/HeaderStructure(guid'36a0b287-eae5-46f7-80a8-f3eb2f9bb328')`,
        },
      },
    ]);
  });

  it("POST entity with array structures", async () => {
    let response = await util.callWrite(request, `/odata/v2/main/HeaderStructure`, {
      ID: "26a0b287-eae5-46f7-80a8-f3eb2f9bb328",
      date: "/Date(1681819200000)/",
      // cds.odata.structs: false
      step_quantity: 2,
      step_startDate: "/Date(1681819200000)/",
      step_endDate: "/Date(1681819200000)/",
      // cds.odata.structs: true
      /*step: {
        quantity: 2,
        startDate: "/Date(1681819200000)/",
        endDate: "/Date(1681819200000)/"
      },*/
      phases: [
        {
          quantity: 2,
          startDate: "/Date(1681819200000)/",
          endDate: "/Date(1681819200000)/",
        },
      ],
    });
    expect(response.statusCode).toEqual(201);
    response = await util.callRead(
      request,
      `/odata/v2/main/HeaderStructure(guid'26a0b287-eae5-46f7-80a8-f3eb2f9bb328')`,
    );
    expect(response.body.d).toMatchObject({
      ID: "26a0b287-eae5-46f7-80a8-f3eb2f9bb328",
      date: "/Date(1681819200000+0000)/",
      // cds.odata.structs: false
      step_quantity: 2,
      step_startDate: "/Date(1681819200000+0000)/",
      step_endDate: "/Date(1681819200000+0000)/",
      // cds.odata.structs: true
      /*step: {
          quantity: 2,
          startDate: "/Date(1681819200000+0000)/",
          endDate: "/Date(1681819200000+0000)/"
        },*/
      phases: [
        {
          quantity: 2,
          startDate: "/Date(1681819200000+0000)/",
          endDate: "/Date(1681819200000+0000)/",
        },
      ],
      __metadata: {
        type: "test.MainService.HeaderStructure",
        uri: `http://${response.request.host.replace(
          "127.0.0.1",
          "localhost",
        )}/odata/v2/main/HeaderStructure(guid'26a0b287-eae5-46f7-80a8-f3eb2f9bb328')`,
      },
    });
  });

  it("Entity with managed compositions", async () => {
    const response = await util.callRead(request, `/odata/v2/main/Orders(1)?$expand=Items`);
    expect(response.body.d).toMatchObject({
      ID: 1,
      Items: {
        results: [
          {
            up__ID: 1,
            pos: 1,
            product: "Cola",
            quantity: 11,
            __metadata: {
              type: "test.MainService.Orders_Items",
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost",
              )}/odata/v2/main/Orders_Items(up__ID=1,pos=1)`,
            },
          },
          {
            up__ID: 1,
            pos: 2,
            product: "Fanta",
            quantity: 12,
            __metadata: {
              type: "test.MainService.Orders_Items",
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost",
              )}/odata/v2/main/Orders_Items(up__ID=1,pos=2)`,
            },
          },
        ],
      },
      __metadata: {
        type: "test.MainService.Orders",
        uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Orders(1)`,
      },
    });
  });

  it("GET entity with special characters in entity name", async () => {
    let response = await util.callRead(request, `/odata/v2/main/Funcionários(1)`);
    expect(response.body.d).toMatchObject({
      ID: 1,
      name: "Toast",
      __metadata: {
        type: "test.MainService.Funcionários",
        uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Funcionários(1)`,
      },
    });
    response = await util.callRead(request, `/odata/v2/main/Funcion%C3%A1rios(1)`);
    expect(response.body.d).toMatchObject({
      ID: 1,
      name: "Toast",
      __metadata: {
        type: "test.MainService.Funcionários",
        uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Funcionários(1)`,
      },
    });
  });

  it("POST bound action on entity with virtual field of same name as action parameter", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/User", {
      name: "Test User",
    });
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callWrite(request, `/odata/v2/main/User_Pay?ID=guid'${id}'&cost=5454m`);
    expect(response.statusCode).toEqual(204);
    response = await util.callWrite(request, `/odata/v2/main/User_Pay?cost=5454m`);
    expect(response.statusCode).toEqual(400);
  });

  it("Header 'odata-version' is removed", async () => {
    let response = await util.callWrite(
      request,
      "/odata/v2/main/Header",
      {
        name: "Test",
      },
      false,
      {
        "odata-version": "2.0",
      },
    );
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    expect(id).toBeDefined();
  });
});
