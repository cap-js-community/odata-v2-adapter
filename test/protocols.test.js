"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");

const util = require("./_env/util/request");
const fs = require("fs");

cds.test(__dirname + "/_env");

let request;

const expectGET = async (request, path) => {
  await expectGETService(request, path);
  await expectGETServiceMetadata(request, path);
  await expectGETServiceData(request, `${path}/Header`);
};

const expectGETService = async (request, path) => {
  const response = await util.callRead(request, path, {
    accept: "application/json",
  });
  expect(response.body).toBeDefined();
  expect(response.body).toEqual({
    d: {
      EntitySets: ["Header", "HeaderItem", "HeaderLine", "Header_texts", "HeaderItem_texts"],
    },
  });
};

const expectGETServiceMetadata = async (request, path) => {
  const response = await util.callRead(request, `${path}/$metadata`, {
    accept: "application/json",
  });
  expect(response.body).toBeDefined();
  expect(response.statusCode).toBe(200);
};

const expectGETServiceData = async (request, path) => {
  const response = await util.callRead(request, path, {
    accept: "application/json",
  });
  expect(response.body).toBeDefined();
  expect(response.body.d.results.length > 0).toEqual(true);
};

const expectRejectProtocol = async (request, path) => {
  let response = await util.callRead(request, `${path}/$metadata`, {
    accept: "application/json",
  });
  expect(response.body).toBeDefined();
  expect(response.text).toEqual("Invalid service protocol. Only OData services supported");

  response = await util.callRead(request, `${path}/Header`, {
    accept: "application/json",
  });
  expect(response.body).toBeDefined();
  expect(response.text).toEqual("Invalid service protocol. Only OData services supported");
};

describe("CDS protocols", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app.server);
  });

  it("service with relative path", () => expectGET(request, "/odata/v2/relative"));

  it("service with absolute path", () => expectGET(request, "/odata/v2/absolute"));

  it("service with relative complex path", () => expectGETService(request, "/odata/v2/relative2/complex/path"));

  it("service with absolute complex path", () => expectGET(request, "/odata/v2/absolute2/complex/path"));

  it("service annotated with @odata", async () => expectGET(request, "/odata/v2/atodata"));

  it("reject service annotated with @rest", async () => expectRejectProtocol(request, '/odata/v2/rest/atrest'));

  it("service annotated with @protocol: 'odata'", async () => expectGET(request, '/odata/v2/atprotocolodata'));

  it("service annotated with @protocol: 'rest'", async () => expectRejectProtocol(request, '/odata/v2/rest/atprotocolrest'));

  it("service annotated with @protocol: ['odata']", async () => expectGET(request, '/odata/v2/atprotocollistodata'));

  it("service annotated with @protocol: ['rest']", async () => expectRejectProtocol(request, '/odata/v2/rest/atprotocollistrest'));

  it("service annotated with @protocol: [{ kind: 'odata', path: 'relative2' }]", async () => expectGET(request, '/odata/v2/relative2'));

  it("service annotated with @protocol: [{ kind: 'odata', path: '/absolute2' }]", async () => expectGET(request, '/odata/v2/absolute2'));

  it("service annotated with @protocol: [{ kind: 'odata', path: '/custom/odata/path' }]", async () => expectGET(request, '/odata/v2/custom/odata/path'));

  it("service annotated with @protocol: [{ kind: 'odata-v4', path: '/custom2/odata/path' }]", async () => expectGET(request, '/odata/v2/custom2/odata/path'));

  it("service annotated with @protocol: [{ kind: 'odata-v4', path: '/odata' }]", async () => expectGET(request, '/odata/v2/odata'));

  it("service annotated with @protocol: [{ kind: 'odata-v4', path: 'odata' }]", async () => expectGET(request, '/odata/v2/odata'));

  it("service annotated with @protocol: [{ kind: 'odata-v4', path: '/odata/v4/odata' }]", async () => expectGET(request, '/odata/v2/odata'));

  it("service with absolute path on batch calls", async () => {
    let response = await util.callRead(request, "/odata/v2/absolute/Header?$top=1");
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(1);
    const ID = response.body.d.results[0].ID;
    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-GET.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    payload = payload.replace(/{{ID}}/g, ID);
    response = await util.callMultipart(request, "/odata/v2/absolute/$batch", payload);
    expect(response.statusCode).toEqual(202);
    const responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(3);
    expect(responses.filter((response) => response.statusCode === 200).length).toEqual(3);
    const [first, second, third] = responses;
    expect(first.body.d.results.length).toEqual(7);
    expect(first.contentTransferEncoding).toEqual("binary");
    expect(second.body.d.results.length).toEqual(7);
    expect(second.contentTransferEncoding).toEqual("binary");
    expect(third.body.d.hasOwnProperty("results")).toEqual(false);
    expect(third.body.d.ID).toEqual(ID);
    expect(third.contentTransferEncoding).toEqual("binary");
  });
});