"use strict";

const fs = require("fs");
const supertest = require("supertest");

const env = require("./_env");
const util = require("./_env/util");
const init = require("./_env/data/init");

let context;
let request;

describe("batch-request", () => {
  beforeAll(async () => {
    context = await env("model", 0, init);
    request = supertest(context.app);
  });

  afterAll(() => {
    env.end(context);
  });

  it("GET request", async () => {
    let response = await util.callRead(request, "/v2/main/Header?$top=1");
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(1);
    const ID = response.body.d.results[0].ID;

    let payload = fs.readFileSync("./test/_env/data/batch/Batch-GET.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    payload = payload.replace(/{{ID}}/g, ID);
    response = await util.callMultipart(request, "/v2/main/$batch", payload);
    expect(response.statusCode).toEqual(200);
    const responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(3);
    expect(responses.filter(response => response.statusCode === 200).length).toEqual(3);
    const [first, second, third] = responses;
    expect(first.body.d.results.length).toEqual(4);

    expect(second.body.d.results.length).toEqual(4);

    expect(third.body.d.hasOwnProperty("results")).toEqual(false);
    expect(third.body.d.ID).toEqual(ID);
  });

  it("POST request", async () => {
    let payload = fs.readFileSync("./test/_env/data/batch/Batch-POST.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    let response = await util.callMultipart(request, "/v2/main/$batch", payload);
    expect(response.statusCode).toEqual(200);

    const responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(4);
    const [first, second, third, fourth] = responses;
    expect(responses.filter(response => response.statusCode === 201)).toEqual([first, second]);
    expect(responses.filter(response => response.statusCode === 200)).toEqual([third, fourth]);

    expect(
      third.body.d.results.filter(
        result => result.name === "Test" && result.Items.results.length === 1 && result.FirstItem === null
      ).length
    ).toEqual(1);

    expect(fourth.body.d.results.filter(result => result.name === "Test").length).toEqual(1);

    const id = first.body.d.ID;
    expect(id).toBeDefined();
    response = await util.callRead(request, `/v2/main/Header(guid'${id}')`);
    expect(response.body.d).toMatchObject({
      __metadata: {
        type: "test.MainService.Header",
        uri: `http://${response.request.host}/v2/main/Header(guid'${id}')`
      },
      ID: id,
      createdBy: "anonymous",
      description: null,
      modifiedAt: null,
      modifiedBy: null,
      name: "Test",
      Items: {
        __deferred: {
          uri: `http://${response.request.host}/v2/main/Header(guid'${id}')/Items`
        }
      }
    });
  });

  it("PUT request", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test"
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    expect(id).toBeDefined();
    let payload = fs.readFileSync("./test/_env/data/batch/Batch-PUT.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    payload = payload.replace(/{{ID}}/g, id);
    response = await util.callMultipart(request, "/v2/main/$batch", payload);
    expect(response.statusCode).toEqual(200);

    const responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(1);
    const [first] = responses;
    expect(first.statusCode).toEqual(200);

    response = await util.callRead(request, `/v2/main/Header(guid'${id}')`);
    expect(response.body.d.name).toEqual("Test Update");
  });

  it("PATCH request", async () => {
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
    expect(id).toBeDefined();
    const itemId = response.body.d.Items.results[0].ID;
    expect(itemId).toBeDefined();
    let payload = fs.readFileSync("./test/_env/data/batch/Batch-PATCH.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    payload = payload.replace(/{{ID}}/g, id);
    payload = payload.replace(/{{ItemID}}/g, itemId);
    response = await util.callMultipart(request, "/v2/main/$batch", payload);
    expect(response.statusCode).toEqual(200);
    const responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(1);
    const [[first]] = responses;
    expect(first.statusCode).toEqual(200);
    response = await util.callRead(request, `/v2/main/Header(guid'${id}')?$expand=Items`);
    expect(response.body.d.name).toEqual("Test Update Changeset");
    expect(response.body.d.Items.results[0].name).toEqual("Test Item Update Changeset");
  });

  it("DELETE request", async () => {
    let response = await util.callWrite(request, "/v2/main/Header", {
      name: "Test"
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    expect(id).toBeDefined();
    let payload = fs.readFileSync("./test/_env/data/batch/Batch-DELETE.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    payload = payload.replace(/{{ID}}/g, id);
    response = await util.callMultipart(request, "/v2/main/$batch", payload);
    expect(response.statusCode).toEqual(200);
    const responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(1);
    const [first] = responses;
    expect(first.statusCode).toEqual(204);
    response = await util.callRead(request, `/v2/main/Header(guid'${id}')`);
    expect(response.statusCode).toEqual(404);
  });

  it("POST action request", async () => {
    let payload = fs.readFileSync("./test/_env/data/batch/Batch-Action.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    let response = await util.callMultipart(request, "/v2/main/$batch", payload);
    expect(response.statusCode).toEqual(200);
    const responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(2);
    expect(responses.filter(response => response.statusCode === 200).length).toEqual(2);
    const [first, second] = responses;
    expect(first.body).toEqual(
      expect.objectContaining({
        d: {
          name: "abc1",
          code: "TEST",
          age: 1
        }
      })
    );
    expect(second.body).toEqual(
      expect.objectContaining({
        d: {
          results: [
            {
              name: "abc2",
              code: "TEST",
              age: 2
            }
          ]
        }
      })
    );
  });
});
