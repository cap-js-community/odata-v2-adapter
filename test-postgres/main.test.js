"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");

const util = require("../test/_env/util/request");

cds.test(__dirname + "/_env");

let request;

describe("postgres-main", () => {
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

  it("GET request", async () => {
    let response = await util.callRead(request, "/odata/v2/main/Header");
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(1);
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${response.body.d.results[0].ID}')`);
    expect(response.body.d).toMatchObject({
      ID: "e0582b6a-6d93-46d9-bd28-98723a285d40",
      date: "/Date(1719446400000)/",
      name: "Header",
      time: "PT12H34M56S",
      price: "12.34",
      stock: 11,
      country: "Germany",
      currency: "EUR",
      dateTime: "/Date(1704110400000+0000)/",
      createdAt: "/Date(1704110400000+0000)/",
      createdBy: "anonymous",
      timestamp: "/Date(1704110400000+0000)/",
      modifiedAt: "/Date(1704110400000+0000)/",
      modifiedBy: "anonymous",
      description: "This is a test Header",
      __metadata: {
        type: "test.MainService.Header",
        uri: `http://${response.request.host.replace(
          "127.0.0.1",
          "localhost",
        )}/odata/v2/main/Header(guid'e0582b6a-6d93-46d9-bd28-98723a285d40')`,
      },
    });
  });
});
