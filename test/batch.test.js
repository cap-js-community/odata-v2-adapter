"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");
// eslint-disable-next-line no-restricted-modules
const fs = require("fs");

const util = require("./_env/util/request");

cds.test(__dirname + "/_env");

let request;

describe("batch", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app.server);
  });

  it("HEAD service", async () => {
    let response = await util.callHead(request, "/odata/v2/main/");
    expect(response.status).toEqual(200);
    expect(response.body).toEqual({});
    expect(response.headers).toMatchObject({
      "content-type": expect.stringMatching(/application\/json/),
      dataserviceversion: "2.0",
    });
    response = await util.callMultipartHead(request, "/odata/v2/main/$batch", undefined, {
      "x-csrf-token": "Fetch",
    });
    expect(response.statusCode).toEqual(405);
    expect(response.headers).toMatchObject({
      dataserviceversion: "2.0",
    });
  });

  it("GET request", async () => {
    let response = await util.callRead(request, "/odata/v2/main/Header?$top=1");
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(1);
    const ID = response.body.d.results[0].ID;

    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-GET.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    payload = payload.replace(/{{ID}}/g, ID);
    response = await util.callMultipart(request, "/odata/v2/main/$batch", payload);
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

  it("GET request with uri escape character", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test %22",
      country: "US",
    });
    expect(response.statusCode).toEqual(201);
    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-GET-Escaped.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    response = await util.callMultipart(request, "/odata/v2/main/$batch", payload);
    expect(response.statusCode).toEqual(202);
    const responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(1);
    expect(responses.filter((response) => response.statusCode === 200).length).toEqual(1);
    const [first] = responses;
    expect(first.body.d.results.length).toEqual(1);
    expect(first.contentTransferEncoding).toEqual("binary");
  });

  it("GET request with charset after boundary in content-type", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test %22",
      country: "US",
    });
    expect(response.statusCode).toEqual(201);
    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-GET.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    response = await util.callMultipart(request, "/odata/v2/main/$batch", payload, "boundary;charset=utf-8");
    expect(response.statusCode).toEqual(202);
    const responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(3);
    const [first] = responses;
    expect(first.body.d.results).toBeDefined();
    expect(first.body.d.results.length).toEqual(9);
    expect(first.body.d.results[0]).toBeDefined();
    expect(first.body.d.results[0].name).toBeDefined();
    expect(first.body.d.results[0].__metadata).toBeDefined();
    expect(first.body.d.results[0].Items).toBeDefined();
    expect(first.body.d.results[0].Items.__deferred).toBeDefined();
  });

  it("POST request", async () => {
    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-POST.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    let response = await util.callMultipart(request, "/odata/v2/main/$batch", payload);
    expect(response.statusCode).toEqual(202);

    const responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(4);
    const [first, second, third, fourth] = responses;
    expect(responses.filter((response) => response.statusCode === 201)).toEqual([first, second]);
    expect(responses.filter((response) => response.statusCode === 200)).toEqual([third, fourth]);

    expect(
      third.body.d.results.filter(
        (result) => result.name === "Test – ABC" && result.Items.results.length === 1 && result.FirstItem === null,
      ).length,
    ).toEqual(1);

    expect(fourth.body.d.results.filter((result) => result.name === "Test – ABC").length).toEqual(1);

    const id = first.body.d.ID;
    expect(id).toBeDefined();
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${id}')`);
    expect(response.body.d).toMatchObject({
      __metadata: {
        type: "test.MainService.Header",
        uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')`,
      },
      ID: id,
      createdBy: "anonymous",
      description: null,
      modifiedBy: "anonymous",
      name: "Test – ABC",
      Items: {
        __deferred: {
          uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Header(guid'${id}')/Items`,
        },
      },
    });
  });

  it("POST request changeset", async () => {
    const requestBoundary = "batch_f992-3b90-6e9f";
    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-POST-Changeset.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    let response = await util.callMultipart(request, "/odata/v2/main/$batch", payload, requestBoundary);
    expect(response.statusCode).toEqual(202);

    const responseBoundary = response.headers["content-type"].split("boundary=")[1];
    const responses = util.splitMultipartResponse(response.body, responseBoundary);
    expect(responses.length).toEqual(1);
    const [first] = responses;
    first.forEach((part) => {
      expect(part.statusCode).toEqual(201);
      expect(part.contentTransferEncoding).toEqual("binary");
    });
  });

  it("POST request with encoding", async () => {
    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-POST-Charset.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    let response = await util.callMultipart(request, "/odata/v2/main/$batch", payload);
    expect(response.statusCode).toEqual(202);

    const responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(1);
    const [first] = responses;
    expect(responses.filter((response) => response.statusCode === 201)).toEqual([first]);

    expect(first.body.d.name).toEqual("Test: èèòàù");
    const id = first.body.d.ID;
    expect(id).toBeDefined();
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${id}')`);
    expect(response.statusCode).toEqual(200);
    expect(response.body.d.name).toEqual("Test: èèòàù");
    expect(response.headers["content-type"]).toMatch(/application\/json/);
  });

  it("POST request changeset with misplaced content-id", async () => {
    const requestBoundary = "batch_f992-3b90-6e9f";
    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-POST-ContentId.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    let response = await util.callMultipart(request, "/odata/v2/main/$batch", payload, requestBoundary);
    expect(response.statusCode).toEqual(202);

    const responseBoundary = response.headers["content-type"].split("boundary=")[1];
    const responses = util.splitMultipartResponse(response.body, responseBoundary);
    expect(responses.length).toEqual(1);
    const [first] = responses;
    first.forEach((part) => {
      expect(part.statusCode).toEqual(201);
      expect(part.contentTransferEncoding).toEqual("binary");
    });
  });

  it("POST request changeset with content-id on navigation property", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    expect(id).toBeDefined();
    const requestBoundary = "batch_f992-3b90-6e9f";
    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-POST-Navigation.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    payload = payload.replace(/{{ID}}/g, id);
    response = await util.callMultipart(request, "/odata/v2/main/$batch", payload, requestBoundary);
    expect(response.statusCode).toEqual(202);

    const responseBoundary = response.headers["content-type"].split("boundary=")[1];
    const responses = util.splitMultipartResponse(response.body, responseBoundary);
    expect(responses.length).toEqual(1);
    const [first] = responses;
    first.forEach((part) => {
      expect(part.statusCode).toEqual(201);
      expect(part.contentTransferEncoding).toEqual("binary");
    });
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${id}')?$expand=Items,Items/Lines`);
    expect(response.body.d).toMatchObject({
      FirstItem_ID: null,
      ID: id,
      Items: {
        results: [
          {
            Lines: {
              results: [
                {
                  name: "Test Line",
                },
              ],
            },
            name: "Test Item",
          },
        ],
      },
      name: "Test",
    });
  });

  it("PUT request", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    expect(id).toBeDefined();
    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-PUT.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    payload = payload.replace(/{{ID}}/g, id);
    response = await util.callMultipart(request, "/odata/v2/main/$batch", payload);
    expect(response.statusCode).toEqual(202);

    const responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(1);
    const [first] = responses;
    expect(first.statusCode).toEqual(200);
    expect(first.contentTransferEncoding).toEqual("binary");
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${id}')`);
    expect(response.body.d.name).toEqual("Test Update");
  });

  it("PATCH request", async () => {
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
    expect(id).toBeDefined();
    const itemId = response.body.d.Items.results[0].ID;
    expect(itemId).toBeDefined();
    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-PATCH.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    payload = payload.replace(/{{ID}}/g, id);
    payload = payload.replace(/{{ItemID}}/g, itemId);
    response = await util.callMultipart(request, "/odata/v2/main/$batch", payload);
    expect(response.statusCode).toEqual(202);
    const responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(1);
    const [[first, second]] = responses;
    expect(first.statusCode).toEqual(200);
    expect(first.contentId).toEqual("1");
    expect(first.contentTransferEncoding).toEqual("binary");
    expect(first.headers["content-id"]).toEqual("1");
    expect(second.statusCode).toEqual(200);
    expect(second.contentId).toBeUndefined();
    expect(second.contentTransferEncoding).toEqual("binary");
    expect(second.headers["content-id"]).toBeUndefined();
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${id}')?$expand=Items`);
    expect(response.body.d.name).toEqual("Test Update Changeset");
    expect(response.body.d.Items.results[0].name).toEqual("Test Item Update Changeset");
  });

  it("PATCH request with misplaced content-id", async () => {
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
    expect(id).toBeDefined();
    const itemId = response.body.d.Items.results[0].ID;
    expect(itemId).toBeDefined();
    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-PATCH-ContentId.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    payload = payload.replace(/{{ID}}/g, id);
    payload = payload.replace(/{{ItemID}}/g, itemId);
    response = await util.callMultipart(request, "/odata/v2/main/$batch", payload);
    expect(response.statusCode).toEqual(202);
    const responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(1);
    const [[first, second]] = responses;
    expect(first.statusCode).toEqual(200);
    expect(first.contentId).toEqual("1");
    expect(first.contentTransferEncoding).toEqual("binary");
    expect(second.statusCode).toEqual(200);
    expect(parseInt(second.contentId)).toEqual(expect.any(Number));
    expect(second.contentTransferEncoding).toEqual("binary");
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${id}')?$expand=Items`);
    expect(response.body.d.name).toEqual("Test Update Changeset");
    expect(response.body.d.Items.results[0].name).toEqual("Test Item Update Changeset");
  });

  it("DELETE request", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test",
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    expect(id).toBeDefined();
    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-DELETE.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    payload = payload.replace(/{{ID}}/g, id);
    response = await util.callMultipart(request, "/odata/v2/main/$batch", payload);
    expect(response.statusCode).toEqual(202);
    const responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(1);
    const [first] = responses;
    expect(first.statusCode).toEqual(204);
    expect(first.contentTransferEncoding).toEqual("binary");
    response = await util.callRead(request, `/odata/v2/main/Header(guid'${id}')`);
    expect(response.statusCode).toEqual(404);
  });

  it("POST action request", async () => {
    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-Action.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    let response = await util.callMultipart(request, "/odata/v2/main/$batch", payload);
    expect(response.statusCode).toEqual(202);
    const responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(2);
    expect(responses.filter((response) => response.statusCode === 200).length).toEqual(2);
    const [first, second] = responses;
    expect(first.body).toEqual(
      expect.objectContaining({
        d: {
          unboundFunction: {
            name: "abc1",
            code: "TEST",
            age: 1,
            __metadata: {
              type: "test.MainService.Result",
            },
          },
        },
      }),
    );
    expect(first.contentTransferEncoding).toEqual("binary");
    expect(second.body).toEqual(
      expect.objectContaining({
        d: {
          unboundAction: {
            name: "abc2",
            code: "TEST",
            age: 2,
            __metadata: {
              type: "test.MainService.Result",
            },
          },
        },
      }),
    );
    expect(second.contentTransferEncoding).toEqual("binary");
  });

  it("POST bound action request", async () => {
    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-BoundEchoAction.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    let response = await util.callMultipart(request, "/odata/v2/main/$batch", payload);
    expect(response.statusCode).toEqual(202);
    const responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(1);
    expect(responses.filter((response) => response.statusCode === 200).length).toEqual(1);
    const [first] = responses;
    expect(first.body.d.Header_boundEchoAction.name).toEqual(null);
  });

  it("GET with x-forwarded headers", async () => {
    let response = await util.callWrite(request, "/odata/v2/main/Header", {
      name: "Test %22",
      country: "US",
    });
    expect(response.statusCode).toEqual(201);
    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-GET-Escaped.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    response = await util.callMultipart(request, "/odata/v2/main/$batch", payload, undefined, {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "test:1234",
      "x-forwarded-path": `/cockpit/$batch`,
    });
    expect(response.statusCode).toEqual(202);
    const responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(1);
    expect(responses.filter((response) => response.statusCode === 200).length).toEqual(1);
    const [first] = responses;
    expect(first.body.d.results[0].__metadata.uri).toMatch(/https:\/\/test:1234\/cockpit\/Header\(guid'[a-z0-9-]*'\)/);
    expect(first.body.d.results[0].__metadata.uri).not.toMatch(/\$batch/);
    expect(first.contentTransferEncoding).toEqual("binary");
  });

  it("Send malformed batch request", async () => {
    const response = await util.callMultipart(request, "/odata/v2/main/$batch", null);
    expect(response.statusCode).toEqual(400);
    expect(response.body).toEqual(["Invalid multipart body"]);
  });

  it("Header 'odata-version' is removed", async () => {
    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-POST-ODataVersion.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    const response = await util.callMultipart(request, "/odata/v2/main/$batch", payload);
    expect(response.statusCode).toEqual(202);
    const responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(1);
    expect(responses.filter((response) => response.statusCode === 201).length).toEqual(1);
  });

  it("POST action request without return", async () => {
    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-Action-NoReturn.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    let response = await util.callMultipart(request, "/odata/v2/main/$batch", payload);
    expect(response.statusCode).toEqual(202);
    const responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(1);
    expect(responses.filter((response) => response.statusCode === 204).length).toEqual(1);
    const [first] = responses;
    expect(first.body).toEqual("");
    expect(first.contentTransferEncoding).toEqual("binary");
  });
});
