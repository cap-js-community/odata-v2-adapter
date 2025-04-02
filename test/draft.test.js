"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");
// eslint-disable-next-line no-restricted-modules
const fs = require("fs");

const util = require("./_env/util/request");

cds.test(__dirname + "/_env");

let request;

describe("draft", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app.server);
  });

  it("GET service", async () => {
    const response = await util.callRead(request, "/odata/v2/draft/", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.body.d.EntitySets.sort()).toEqual(
      ["Header", "HeaderItem", "HeaderLine", "Header_texts", "HeaderItem_texts"].sort(),
    );
  });

  it("GET $metadata", async () => {
    const response = await util.callRead(request, "/odata/v2/draft/$metadata", {
      accept: "application/xml",
    });
    expect(response.body).toBeDefined();
    expect(response.text).toMatchSnapshot();
  });

  it("GET request", async () => {
    let response = await util.callRead(request, "/odata/v2/draft/Header");
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(7);
    response = await util.callRead(request, "/odata/v2/draft/Header?$inlinecount=allpages");
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(7);
    expect(response.body.d.__count).toEqual("7");
  });

  it("GET request with parameters", async () => {
    let response = await util.callWrite(request, "/odata/v2/draft/Header", {
      name: "Test",
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    const etag = response.body.d.__metadata.etag;
    expect(typeof etag).toEqual("string");
    response = await util.callRead(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.body).toBeDefined();
    expect(response.body.d).toMatchObject({
      __metadata: {
        uri: `http://${response.request.host.replace(
          "127.0.0.1",
          "localhost",
        )}/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`,
        type: "test.DraftService.Header",
        etag: etag,
      },
      HasActiveEntity: false,
      HasDraftEntity: false,
      ID: id,
      IsActiveEntity: false,
      createdBy: "anonymous",
      modifiedBy: "anonymous",
      name: "Test",
      description: null,
      Items: {
        __deferred: {
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost",
          )}/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/Items`,
        },
      },
      SiblingEntity: {
        __deferred: {
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost",
          )}/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/SiblingEntity`,
        },
      },
      DraftAdministrativeData: {
        __deferred: {
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost",
          )}/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/DraftAdministrativeData`,
        },
      },
    });
    response = await util.callRead(
      request,
      `/odata/v2/draft/Header?$filter=ID eq guid'${id}' and IsActiveEntity eq false&$select=ID,name&$expand=Items&$skip=0&$top=1&$orderby=name asc`,
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(1);
    expect(response.body.d.results[0].__metadata.etag).toEqual(etag);
  });

  it("POST request", async () => {
    let response = await util.callWrite(request, "/odata/v2/draft/Header", {
      name: "Test Create",
    });
    expect(response.statusCode).toEqual(201);
    const etag = response.body.d.__metadata.etag;
    expect(typeof etag).toEqual("string");
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    const id = response.body.d.ID;
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost",
          )}/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`,
          type: "test.DraftService.Header",
          etag: etag,
        },
        HasActiveEntity: false,
        HasDraftEntity: false,
        ID: id,
        IsActiveEntity: false,
        createdBy: "anonymous",
        modifiedBy: "anonymous",
        name: "Test Create",
        description: null,
        Items: {
          __deferred: {
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost",
            )}/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/Items`,
          },
        },
        SiblingEntity: {
          __deferred: {
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost",
            )}/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/SiblingEntity`,
          },
        },
        DraftAdministrativeData: {
          __deferred: {
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost",
            )}/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/DraftAdministrativeData`,
          },
        },
      },
    });
    response = await util.callRead(request, "/odata/v2/draft/Header?$filter=name eq 'Test Create'");
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(0); // No Active
    response = await util.callRead(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost",
          )}/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`,
          type: "test.DraftService.Header",
          etag: etag,
        },
        HasActiveEntity: false,
        HasDraftEntity: false,
        ID: id,
        IsActiveEntity: false,
        createdBy: "anonymous",
        modifiedBy: "anonymous",
        name: "Test Create",
        description: null,
        Items: {
          __deferred: {
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost",
            )}/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/Items`,
          },
        },
        SiblingEntity: {
          __deferred: {
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost",
            )}/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/SiblingEntity`,
          },
        },
        DraftAdministrativeData: {
          __deferred: {
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost",
            )}/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/DraftAdministrativeData`,
          },
        },
      },
    });
    response = await util.callRead(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/Items`);
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(0);
    response = await util.callWrite(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/Items`, {
      name: "Test Update",
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    const itemId = response.body.d.ID;
    const itemEtag = response.body.d.__metadata.etag;
    expect(itemEtag).not.toBeDefined();
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          type: "test.DraftService.HeaderItem",
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost",
          )}/odata/v2/draft/HeaderItem(ID=guid'${itemId}',IsActiveEntity=false)`,
        },
        HasActiveEntity: false,
        HasDraftEntity: false,
        ID: itemId,
        IsActiveEntity: false,
        description: null,
        endAt: null,
        header_ID: id,
        name: "Test Update",
        startAt: null,
        header: {
          __deferred: {
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost",
            )}/odata/v2/draft/HeaderItem(ID=guid'${itemId}',IsActiveEntity=false)/header`,
          },
        },
        SiblingEntity: {
          __deferred: {
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost",
            )}/odata/v2/draft/HeaderItem(ID=guid'${itemId}',IsActiveEntity=false)/SiblingEntity`,
          },
        },
        DraftAdministrativeData: {
          __deferred: {
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost",
            )}/odata/v2/draft/HeaderItem(ID=guid'${itemId}',IsActiveEntity=false)/DraftAdministrativeData`,
          },
        },
      },
    });
    response = await util.callRead(
      request,
      `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/Items(ID=guid'${itemId}',IsActiveEntity=false)`,
    );
    expect(response.body).toBeDefined();
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          type: "test.DraftService.HeaderItem",
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost",
          )}/odata/v2/draft/HeaderItem(ID=guid'${itemId}',IsActiveEntity=false)`,
        },
        HasActiveEntity: false,
        HasDraftEntity: false,
        ID: itemId,
        IsActiveEntity: false,
        description: null,
        endAt: null,
        header_ID: id,
        name: "Test Update",
        startAt: null,
        header: {
          __deferred: {
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost",
            )}/odata/v2/draft/HeaderItem(ID=guid'${itemId}',IsActiveEntity=false)/header`,
          },
        },
        SiblingEntity: {
          __deferred: {
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost",
            )}/odata/v2/draft/HeaderItem(ID=guid'${itemId}',IsActiveEntity=false)/SiblingEntity`,
          },
        },
        DraftAdministrativeData: {
          __deferred: {
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost",
            )}/odata/v2/draft/HeaderItem(ID=guid'${itemId}',IsActiveEntity=false)/DraftAdministrativeData`,
          },
        },
      },
    });
  });

  it("PUT request", async () => {
    let response = await util.callWrite(request, "/odata/v2/draft/Header", {
      name: "Test",
    });
    expect(response.body).toBeDefined();
    expect(response.statusCode).toEqual(201);
    let etag = response.body.d.__metadata.etag;
    expect(typeof etag).toEqual("string");

    // 428 precondition required
    const id = response.body.d.ID;
    response = await util.callWrite(
      request,
      `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`,
      {
        name: "Test2",
      },
      true,
    );
    expect(response.statusCode).toEqual(428);

    // 1st Patch OK
    response = await util.callWrite(
      request,
      `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`,
      {
        name: "Test2",
      },
      true,
      {
        "If-Match": etag,
      },
    );
    expect(response.statusCode).toEqual(200);
    etag = response.body.d.__metadata.etag;

    // 2nd Patch OK
    response = await util.callWrite(
      request,
      `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`,
      {
        name: "Test3",
      },
      true,
      {
        "If-Match": etag,
      },
    );
    expect(response.statusCode).toEqual(200);
    etag = response.body.d.__metadata.etag;

    // 1st Batch Patch OK
    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-Draft-MERGE.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    payload = payload.replace(/{{ID}}/g, id);
    payload = payload.replace(/{{ETAG}}/g, etag);
    response = await util.callMultipart(request, "/odata/v2/draft/$batch", payload);
    expect(response.statusCode).toEqual(202);
    let responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(1);
    response = responses[0][0];
    expect(response.statusCode).toEqual(200);
    etag = response.headers.etag;
    expect(response.body.d.__metadata.etag).toEqual(etag);

    // 2nd Batch Patch OK
    payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-Draft-MERGE.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    payload = payload.replace(/{{ID}}/g, id);
    payload = payload.replace(/{{ETAG}}/g, etag);
    response = await util.callMultipart(request, "/odata/v2/draft/$batch", payload);
    expect(response.statusCode).toEqual(202);
    responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(1);
    response = responses[0][0];
    expect(response.statusCode).toEqual(200);
    etag = response.headers.etag;
    expect(response.body.d.__metadata.etag).toEqual(etag);

    // Read OK
    response = await util.callRead(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.statusCode).toEqual(200);
    expect(response.body.d.__metadata.etag).toEqual(etag);
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost",
          )}/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`,
          type: "test.DraftService.Header",
        },
        createdBy: "anonymous",
        modifiedBy: "anonymous",
        name: "Test4",
        description: null,
        Items: {
          __deferred: {
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost",
            )}/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/Items`,
          },
        },
      },
    });

    // Update collection not allowed
    response = await util.callWrite(
      request,
      "/odata/v2/draft/Header",
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
          value: "Method PATCH is not allowed for entity collections",
        },
        innererror: {
          errordetails: [
            {
              code: "405",
              message: {
                lang: "en",
                value: "Method PATCH is not allowed for entity collections",
              },
              severity: "error",
            },
          ],
        },
      },
    });
  });

  it("DELETE request", async () => {
    let response = await util.callWrite(request, "/odata/v2/draft/Header", {
      name: "Test",
    });
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    const etag = response.body.d.__metadata.etag;
    response = await util.callDelete(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`, {
      "If-Match": etag,
    });
    expect(response.statusCode).toEqual(204);
    response = await util.callRead(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.statusCode).toEqual(404);
    response = await util.callDelete(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`, {
      "If-Match": "*",
    });
    expect(response.statusCode).toEqual(404);
    expect(response.body).toMatchObject({
      error: {
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
      },
    });
  });

  it("POST activate request", async () => {
    let response = await util.callWrite(request, "/odata/v2/draft/Header", {
      name: "Test Create",
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    const id = response.body.d.ID;
    let etag = response.body.d.__metadata.etag;
    response = await util.callRead(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.body).toBeDefined();
    expect(response.body.d.ID).toEqual(id);
    response = await util.callRead(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=true)`);
    expect(response.statusCode).toEqual(404);
    response = await util.callWrite(
      request,
      `/odata/v2/draft/Header_draftPrepare?ID=guid'${id}'&IsActiveEntity=false`,
      {},
      false,
      {
        "If-Match": etag,
      },
    );
    expect(response.statusCode).toEqual(200);
    response = await util.callWrite(
      request,
      `/odata/v2/draft/Header_draftActivate?ID=guid'${id}'&IsActiveEntity=false`,
      {},
      false,
      {
        "If-Match": etag,
      },
    );
    expect(response.statusCode).toEqual(201);

    expect(JSON.parse(response.headers["sap-message"])).toEqual({
      code: "INFO",
      details: [],
      message: "All good!",
      severity: "success",
      target: "name",
    });

    etag = response.body.d.__metadata.etag;
    expect(etag).toBeDefined();
    response = await util.callRead(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.statusCode).toEqual(404);
    response = await util.callRead(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=true)`);
    expect(response.statusCode).toEqual(200);
    expect(response.body.d.ID).toEqual(id);
    etag = response.body.d.__metadata.etag;
    response = await util.callWrite(
      request,
      `/odata/v2/draft/Header_draftEdit?ID=guid'${id}'&IsActiveEntity=true`,
      {},
      false,
      {
        "If-Match": etag,
      },
    );
    expect(response.statusCode).toEqual(201);
    response = await util.callRead(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.statusCode).toEqual(200);
    expect(response.body.d.ID).toEqual(id);
  });

  it("POST activate request (batch)", async () => {
    let response = await util.callWrite(request, "/odata/v2/draft/Header", {
      name: "Test Create",
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    const id = response.body.d.ID;
    let etag = response.body.d.__metadata.etag;

    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-Draft-MERGE.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    payload = payload.replace(/{{ID}}/g, id);
    payload = payload.replace(/{{ETAG}}/g, etag);
    response = await util.callMultipart(request, "/odata/v2/draft/$batch", payload);
    expect(response.statusCode).toEqual(202);
    let responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(1);
    response = responses[0][0];
    expect(response.statusCode).toEqual(200);
    etag = response.headers.etag;
    expect(response.body.d.__metadata.etag).toEqual(etag);

    payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-Draft-Activate.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    payload = payload.replace(/{{ID}}/g, id);
    payload = payload.replace(/{{ETAG}}/g, etag);
    response = await util.callMultipart(request, "/odata/v2/draft/$batch", payload);
    expect(response.statusCode).toEqual(202);
    responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(1);
    expect(responses[0].length).toEqual(2);
    response = responses[0][0];
    expect(response.statusCode).toEqual(200);
    etag = response.headers.etag;
    expect(response.body.d.__metadata.etag).toEqual(etag);

    expect(JSON.parse(response.headers["sap-message"])).toEqual({
      code: "WARN01",
      details: [
        {
          code: "WARN02",
          message: "An Warning occurred",
          severity: "warning",
          target: "name",
        },
      ],
      message: "An Warning occurred",
      severity: "warning",
      target: "Header(ID=guid'1b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/name",
    });

    response = responses[0][1];
    expect(response.statusCode).toEqual(201);
    etag = response.headers.etag;
    expect(response.body.d.__metadata.etag).toEqual(etag);

    expect(JSON.parse(response.headers["sap-message"])).toEqual({
      code: "INFO",
      details: [],
      message: "All good!",
      severity: "success",
      target: "name",
    });

    payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-Draft-Delete.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    payload = payload.replace(/{{ID}}/g, id);
    payload = payload.replace(/{{ETAG}}/g, etag);
    response = await util.callMultipart(request, "/odata/v2/draft/$batch", payload);
    expect(response.statusCode).toEqual(202);

    response = await util.callRead(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.statusCode).toEqual(404);
    response = await util.callRead(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=true)`);
    expect(response.statusCode).toEqual(404);
  });

  it("POST activate request (multiple batch)", async () => {
    let response = await util.callWrite(request, "/odata/v2/draft/Header", {
      name: "Test Create",
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    const id = response.body.d.ID;
    let etag = response.body.d.__metadata.etag;

    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-Draft-MERGE.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    payload = payload.replace(/{{ID}}/g, id);
    payload = payload.replace(/{{ETAG}}/g, etag);
    response = await util.callMultipart(request, "/odata/v2/draft/$batch", payload);
    expect(response.statusCode).toEqual(202);
    let responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(1);
    response = responses[0][0];
    expect(response.statusCode).toEqual(200);
    etag = response.headers.etag;
    expect(response.body.d.__metadata.etag).toEqual(etag);

    payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-Draft-ActivateMultiBatch.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    payload = payload.replace(/{{ID}}/g, id);
    payload = payload.replace(/{{ETAG}}/g, etag);
    response = await util.callMultipart(request, "/odata/v2/draft/$batch", payload, "batch_7aea-4212-7158");
    expect(response.statusCode).toEqual(202);
    responses = util.splitMultipartResponse(response.body, "batch_7aea-4212-7158");
    expect(responses.length).toEqual(2);
    expect(responses[0].length).toEqual(1);
    response = responses[0][0];
    expect(response.statusCode).toEqual(200);
    etag = response.headers.etag;
    expect(response.body.d.__metadata.etag).toEqual(etag);

    expect(JSON.parse(response.headers["sap-message"])).toEqual({
      code: "WARN01",
      details: [
        {
          code: "WARN02",
          message: "An Warning occurred",
          severity: "warning",
          target: "name",
        },
      ],
      message: "An Warning occurred",
      severity: "warning",
      target: "Header(ID=guid'1b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/name",
    });

    response = responses[1][0];
    expect(responses[1].length).toEqual(1);
    expect(response.statusCode).toEqual(201);
    etag = response.headers.etag;
    expect(response.body.d.__metadata.etag).toEqual(etag);

    expect(JSON.parse(response.headers["sap-message"])).toEqual({
      code: "INFO",
      details: [],
      message: "All good!",
      severity: "success",
      target: "name",
    });

    payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-Draft-Delete.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    payload = payload.replace(/{{ID}}/g, id);
    payload = payload.replace(/{{ETAG}}/g, etag);
    response = await util.callMultipart(request, "/odata/v2/draft/$batch", payload);
    expect(response.statusCode).toEqual(202);

    response = await util.callRead(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.statusCode).toEqual(404);
    response = await util.callRead(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=true)`);
    expect(response.statusCode).toEqual(404);
  });

  it("DELETE draft request", async () => {
    let response = await util.callWrite(request, "/odata/v2/draft/Header", {
      name: "Test Create",
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callRead(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.body).toBeDefined();
    expect(response.body.d.ID).toEqual(id);
    response = await util.callDelete(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`, {
      "If-Match": "*",
    });
    expect(response.statusCode).toEqual(204);
    response = await util.callRead(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.statusCode).toEqual(404);
  });

  it("DELETE draft for active entity", async () => {
    let response = await util.callWrite(request, "/odata/v2/draft/Header", {
      name: "Test Create",
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callRead(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.body).toBeDefined();
    expect(response.body.d.ID).toEqual(id);
    response = await util.callRead(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=true)`);
    expect(response.statusCode).toEqual(404);
    response = await util.callWrite(
      request,
      `/odata/v2/draft/Header_draftPrepare?ID=guid'${id}'&IsActiveEntity=false`,
      {},
      false,
      {
        "If-Match": "*",
      },
    );
    expect(response.statusCode).toEqual(200);
    response = await util.callWrite(
      request,
      `/odata/v2/draft/Header_draftActivate?ID=guid'${id}'&IsActiveEntity=false`,
      {},
      false,
      {
        "If-Match": "*",
      },
    );
    expect(response.statusCode).toEqual(201);

    expect(JSON.parse(response.headers["sap-message"])).toEqual({
      code: "INFO",
      details: [],
      message: "All good!",
      severity: "success",
      target: "name",
    });

    response = await util.callRead(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.statusCode).toEqual(404);
    response = await util.callRead(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=true)`);
    expect(response.statusCode).toEqual(200);
    expect(response.body.d.ID).toEqual(id);
    response = await util.callWrite(
      request,
      `/odata/v2/draft/Header_draftEdit?ID=guid'${id}'&IsActiveEntity=true`,
      {},
      false,
      {
        "If-Match": "*",
      },
    );
    expect(response.statusCode).toEqual(201);
    response = await util.callRead(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.statusCode).toEqual(200);
    response = await util.callDelete(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`, {
      "If-Match": "*",
    });
    expect(response.statusCode).toEqual(204);
    response = await util.callRead(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.statusCode).toEqual(404);
    response = await util.callRead(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=true)`);
    expect(response.statusCode).toEqual(200);
    response = await util.callRead(
      request,
      `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=true)?$expand=DraftAdministrativeData%2CSiblingEntity`,
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body.d.ID).toEqual(id);
    expect(response.body.d.SiblingEntity).toEqual(null);
  });

  it("Tests unsupported draft requests", async () => {
    let response = await util.callWrite(request, "/odata/v2/draft/Header", {
      name: "Test Header",
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callWrite(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/Items`, {
      name: "Test Item",
      description: "ABC",
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    response = await util.callRead(
      request,
      `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/Items?$filter=(IsActiveEntity eq true and substringof('Item',name)) or (IsActiveEntity eq false and (substringof('Item',name) or HasActiveEntity eq false))`,
    );
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    expect(response.body.d).toMatchObject({
      results: [
        {
          name: "Test Item",
          description: "ABC",
          startAt: null,
          endAt: null,
          header_ID: id,
          NextItem_ID: null,
          IsActiveEntity: false,
          HasDraftEntity: false,
          HasActiveEntity: false,
        },
      ],
    });
    response = await util.callRead(
      request,
      `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/Items?$filter=(IsActiveEntity eq true and (substringof('_',name) or substringof('ABC',description))) or (IsActiveEntity eq false and ((substringof('_',name) or substringof('ABC',description)) or HasActiveEntity eq false))`,
    );
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    expect(response.body.d).toMatchObject({
      results: [
        {
          name: "Test Item",
          description: "ABC",
          startAt: null,
          endAt: null,
          header_ID: id,
          NextItem_ID: null,
          IsActiveEntity: false,
          HasDraftEntity: false,
          HasActiveEntity: false,
        },
      ],
    });
    response = await util.callRead(
      request,
      `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/Items?$filter=((IsActiveEntity eq true and substringof('Item2',name)) or (IsActiveEntity eq false and (substringof('Item2',name) or HasActiveEntity eq false))) or description eq 'ABC'`,
    );
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    expect(response.body.d).toMatchObject({
      results: [
        {
          name: "Test Item",
          description: "ABC",
          startAt: null,
          endAt: null,
          header_ID: id,
          NextItem_ID: null,
          IsActiveEntity: false,
          HasDraftEntity: false,
          HasActiveEntity: false,
        },
      ],
    });
    response = await util.callRead(
      request,
      decodeURIComponent(
        `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/Items?$filter=((IsActiveEntity eq true and substringof('Item2',name)) or (IsActiveEntity eq false and (substringof('Item2',name) or HasActiveEntity eq false))) or description eq 'ABC'`,
      ),
    );
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    expect(response.body.d).toMatchObject({
      results: [
        {
          name: "Test Item",
          description: "ABC",
          startAt: null,
          endAt: null,
          header_ID: id,
          NextItem_ID: null,
          IsActiveEntity: false,
          HasDraftEntity: false,
          HasActiveEntity: false,
        },
      ],
    });
    response = await util.callRead(
      request,
      decodeURIComponent(
        `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/Items?$filter=(IsActiveEntity eq true and name eq 'Test Item') or (IsActiveEntity eq false and (name eq 'Test Item' or HasActiveEntity eq false))`,
      ),
    );
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    expect(response.body.d).toMatchObject({
      results: [
        {
          name: "Test Item",
          description: "ABC",
          startAt: null,
          endAt: null,
          header_ID: id,
          NextItem_ID: null,
          IsActiveEntity: false,
          HasDraftEntity: false,
          HasActiveEntity: false,
        },
      ],
    });
  });

  it("Tests draft messages", async () => {
    let response = await util.callWrite(request, "/odata/v2/draft/Header", {
      name: "Test Create",
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    const id = response.body.d.ID;
    let etag = response.body.d.__metadata.etag;
    response = await util.callWrite(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/texts`, {
      description: "Test Text",
      locale: "en",
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    const textId = response.body.d.ID_texts;
    expect(textId).toBeDefined();
    response = await util.callWrite(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/Items`, {
      name: "Test Item",
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    const itemId = response.body.d.ID;
    response = await util.callWrite(
      request,
      `/odata/v2/draft/HeaderItem(ID=guid'${itemId}',IsActiveEntity=false)/texts`,
      {
        description: "Test Item Text",
        locale: "en",
      },
    );
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    const itemTextId = response.body.d.ID_texts;

    response = await util.callWrite(
      request,
      `/odata/v2/draft/Header_draftPrepare?ID=guid'${id}'&IsActiveEntity=false`,
      {},
      false,
      {
        "If-Match": etag,
      },
    );
    expect(JSON.parse(response.headers["sap-message"])).toEqual({
      code: "WARN01",
      details: [
        {
          code: "WARN02",
          message: "An Warning occurred",
          severity: "warning",
          target: "name",
        },
      ],
      message: "An Warning occurred",
      severity: "warning",
      target: "Header(ID=guid'1b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/name",
    });

    response = await util.callRead(request, `/odata/v2/draft/HeaderItem(ID=guid'${itemId}',IsActiveEntity=false)`);
    expect(response.body).toBeDefined();
    expect(response.body.d).toMatchObject({
      ID: itemId,
      name: "Test Item",
      description: null,
      startAt: null,
      endAt: null,
    });
    expect(JSON.parse(response.headers["sap-message"])).toEqual({
      code: "WARN01",
      details: [],
      message: "An Warning occurred",
      severity: "warning",
      target: "Items(ID=guid'2b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/name",
    });

    response = await util.callRead(
      request,
      `/odata/v2/draft/HeaderItem_texts(ID_texts=guid'${itemTextId}',IsActiveEntity=false)`,
    );
    expect(response.body).toBeDefined();
    expect(response.body.d).toMatchObject({
      ID_texts: itemTextId,
      description: "Test Item Text",
    });
    expect(JSON.parse(response.headers["sap-message"])).toEqual({
      code: "WARN01",
      details: [],
      message: "An Warning occurred",
      severity: "warning",
      target:
        "Items(ID=guid'2b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/texts(ID=guid'3b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/description",
    });
  });

  it("Tests transientOnly", async () => {
    let response = await util.callWrite(request, "/odata/v2/draft/Header", {
      name: "Test Create",
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    const id = response.body.d.ID;
    let etag = response.body.d.__metadata.etag;

    response = await util.callWrite(
      request,
      `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`,
      {
        name: "Test Create - Update 1",
      },
      true,
      {
        "If-Match": etag,
      },
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    etag = response.body.d.__metadata.etag;

    expect(JSON.parse(response.headers["sap-message"])).toEqual({
      code: "INFO",
      details: [
        {
          code: "WARN01",
          message: "An Warning occurred 1",
          severity: "warning",
          target: "Header(ID=guid'1b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/name",
        },
        {
          code: "WARN02",
          message: "An Warning occurred 2",
          severity: "warning",
          target: "/#TRANSIENT#",
        },
        {
          code: "WARN03",
          message: "An Warning occurred 3",
          severity: "warning",
          target: "/#TRANSIENT#/Header",
        },
      ],
      message: "All good!",
      severity: "success",
      target: "name",
    });

    response = await util.callWrite(
      request,
      `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`,
      {
        name: "Test Create - Update 1",
      },
      true,
      {
        "If-Match": etag,
        "sap-messages": "transientOnly",
      },
    );
    expect(response.statusCode).toEqual(200);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    etag = response.body.d.__metadata.etag;

    expect(JSON.parse(response.headers["sap-message"])).toEqual({
      code: "WARN02",
      details: [
        {
          code: "WARN03",
          message: "An Warning occurred 3",
          severity: "warning",
          target: "/#TRANSIENT#/Header",
        },
      ],
      message: "An Warning occurred 2",
      severity: "warning",
      target: "/#TRANSIENT#",
    });

    response = await util.callWrite(
      request,
      `/odata/v2/draft/Header_draftPrepare?ID=guid'${id}'&IsActiveEntity=false`,
      {},
      false,
      {
        "If-Match": etag,
      },
    );
    expect(JSON.parse(response.headers["sap-message"])).toEqual({
      code: "WARN01",
      details: [
        {
          code: "WARN02",
          message: "An Warning occurred",
          severity: "warning",
          target: "name",
        },
      ],
      message: "An Warning occurred",
      severity: "warning",
      target: "Header(ID=guid'1b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/name",
    });
  });

  it("Tests transientOnly (batch)", async () => {
    let response = await util.callWrite(request, "/odata/v2/draft/Header", {
      name: "Test Create",
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    const id = response.body.d.ID;
    let etag = response.body.d.__metadata.etag;

    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-Draft-MERGE-Messages.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    payload = payload.replace(/{{ID}}/g, id);
    payload = payload.replace(/{{ETAG}}/g, etag);
    response = await util.callMultipart(request, "/odata/v2/draft/$batch", payload);
    expect(response.statusCode).toEqual(202);
    const responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(1);
    response = responses[0][0];
    expect(response.statusCode).toEqual(200);
    expect(response.body).toMatchObject({
      d: {
        ID: id,
        name: "Test Create - Update",
      },
    });
    expect(JSON.parse(response.headers["sap-message"])).toEqual({
      code: "WARN02",
      details: [
        {
          code: "WARN03",
          message: "An Warning occurred 3",
          severity: "warning",
          target: "/#TRANSIENT#/Header",
        },
      ],
      message: "An Warning occurred 2",
      severity: "warning",
      target: "/#TRANSIENT#",
    });
  });

  it("GET draft administrative data request", async () => {
    let response = await util.callWrite(request, "/odata/v2/draft/Header", {
      name: "Test Create",
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callRead(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.body).toBeDefined();
    expect(response.body.d.ID).toEqual(id);
    response = await util.callRead(
      request,
      `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/DraftAdministrativeData`,
    );
    expect(response.body).toBeDefined();
    const draftUUID = response.body.d.DraftUUID;
    expect(response.body).toEqual({
      d: {
        CreatedByUser: "anonymous",
        CreationDateTime: expect.stringMatching(/\/Date\(.*\)\//),
        DraftIsCreatedByMe: true,
        DraftIsProcessedByMe: true,
        DraftUUID: expect.any(String),
        InProcessByUser: "anonymous",
        LastChangeDateTime: expect.stringMatching(/\/Date\(.*\)\//),
        LastChangedByUser: "anonymous",
        __metadata: {
          type: "test.DraftService.DraftAdministrativeData",
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost",
          )}/odata/v2/draft/DraftAdministrativeData(guid'${draftUUID}')`,
        },
      },
    });
    response = await util.callRead(request, `/odata/v2/draft/DraftAdministrativeData(guid'${draftUUID}')`);
    expect(response.body).toBeDefined;
    expect(response.body).toEqual({
      error: {
        code: "400",
        innererror: {
          errordetails: [
            {
              code: "400",
              message: {
                lang: "en",
                value: "INVALID_DRAFT_REQUEST",
              },
              severity: "error",
              target: "/#TRANSIENT#",
            },
          ],
        },
        message: {
          lang: "en",
          value: "INVALID_DRAFT_REQUEST",
        },
        severity: "error",
        target: "/#TRANSIENT#",
      },
    });
    response = await util.callDelete(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`, {
      "If-Match": "*",
    });
    expect(response.statusCode).toEqual(204);
    response = await util.callRead(request, `/odata/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.statusCode).toEqual(404);
  });
});
