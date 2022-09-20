"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");
// eslint-disable-next-line no-restricted-modules
const fs = require("fs");

const util = require("./_env/util/request");

cds.test(__dirname + "/_env");

let request;

describe("main-xml", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app);
  });

  it("HEAD service", async () => {
    let response = await util.callHead(request, "/v2/main?$format=atom");
    expect(response.status).toEqual(200);
    expect(response.text).not.toBeDefined();
    expect(response.headers).toMatchObject({
      "content-type": "application/xml;charset=utf-8",
      dataserviceversion: "2.0",
    });
    response = await util.callHead(request, "/v2/main/Header");
    expect(response.status).toEqual(405);
    response = await util.callHead(request, "/v2/main/Header", {
      "content-type": "application/xml",
    });
    expect(response.status).toEqual(405);
  });

  it("GET service XML format", async () => {
    let response = await util.callRead(request, "/v2/main", {
      accept: "application/xml",
    });
    expect(response.text).toBeDefined();
    response.text = response.text.replace(/http:\/\/localhost:(\d*)\//, "");
    expect(response.text).toMatchSnapshot();
    response = await util.callRead(request, "/v2/main/", {
      accept: "application/xml",
    });
    expect(response.text).toBeDefined();
    response.text = response.text.replace(/http:\/\/localhost:(\d*)\//, "");
    expect(response.text).toMatchSnapshot();
    response = await util.callRead(request, "/v2/main");
    expect(response.text).toBeDefined();
    response.text = response.text.replace(/http:\/\/localhost:(\d*)\//, "");
    expect(response.text).toMatchSnapshot();
    response = await util.callRead(request, "/v2/main/?$format=atom");
    response.text = response.text.replace(/http:\/\/localhost:(\d*)\//, "");
    expect(response.text).toMatchSnapshot();
  });

  it("GET request", async () => {
    let response = await util.callRead(
      request,
      "/v2/main/Header?$filter=ID eq guid'e0582b6a-6d93-46d9-bd28-98723a285d40'&$format=atom"
    );
    expect(response.text).toBeDefined();
    response.text = cleanResponse(response.text);
    expect(response.text).toMatchSnapshot();
    expect(response.headers["content-type"]).toEqual("application/atom+xml;charset=utf-8");

    response = await util.callRead(request, "/v2/main/Header(guid'e0582b6a-6d93-46d9-bd28-98723a285d40')?$format=atom");
    expect(response.text).toBeDefined();
    response.text = cleanResponse(response.text);
    expect(response.headers["content-type"]).toEqual("application/atom+xml;charset=utf-8");
    expect(response.text).toMatchSnapshot();

    response = await util.callRead(request, "/v2/main/Header(guid'e0582b6a-6d93-46d9-bd28-98723a285d40')", {
      accept: "application/xml",
    });
    expect(response.text).toBeDefined();
    response.text = cleanResponse(response.text);
    expect(response.headers["content-type"]).toEqual("application/atom+xml;charset=utf-8");
    expect(response.text).toMatchSnapshot();

    response = await util.callRead(
      request,
      "/v2/main/Header(guid'e0582b6a-6d93-46d9-bd28-98723a285d40')?$expand=Items",
      {
        accept: "application/xml",
      }
    );
    expect(response.text).toBeDefined();
    response.text = cleanResponse(response.text);
    expect(response.headers["content-type"]).toEqual("application/atom+xml;charset=utf-8");
    expect(response.text).toMatchSnapshot();

    response = await util.callRead(request, "/v2/main/Header(guid'e0582b6a-6d93-46d9-bd28-98723a285d40')/name", {
      accept: "application/xml",
    });
    expect(response.text).toBeDefined();
    response.text = cleanResponse(response.text);
    expect(response.headers["content-type"]).toEqual("application/atom+xml;charset=utf-8");
    expect(response.text).toMatchSnapshot();

    response = await util.callRead(request, "/v2/main/Header(guid'e0582b6a-6d93-46d9-bd28-98723a285d40')/name/$value", {
      accept: "application/xml",
    });
    expect(response.text).toBeDefined();
    response.text = cleanResponse(response.text);
    expect(response.headers["content-type"]).toEqual("text/plain");
    expect(response.text).toEqual("Header");
  });

  it("POST request", async () => {
    let payload = fs.readFileSync(__dirname + "/_env/util/atom/Atom-POST.txt", "utf8");
    payload = payload.replace(/\r\n/g, "");
    let response = await util.callWrite(request, "/v2/main/Header", payload, false, {
      accept: "application/xml",
      "content-type": "application/atom+xml",
    });
    expect(response.headers["content-type"]).toEqual("application/atom+xml;charset=utf-8");
    response.text = cleanResponse(response.text);
    expect(response.text).toMatchSnapshot();
  });

  it("PUT request", async () => {
    let payload = fs.readFileSync(__dirname + "/_env/util/atom/Atom-POST.txt", "utf8");
    payload = payload.replace(/<d:ID>a/g, "<d:ID>b");
    payload = payload.replace(/\r\n/g, "");
    let response = await util.callWrite(request, "/v2/main/Header", payload, false, {
      accept: "application/xml",
      "content-type": "application/atom+xml",
    });
    payload = fs.readFileSync(__dirname + "/_env/util/atom/Atom-PUT.txt", "utf8");
    payload = payload.replace(/\r\n/g, "");
    response = await util.callWrite(
      request,
      "/v2/main/Header(guid'b853cdb8-5531-4141-b319-d405ae5d1e63')",
      payload,
      true,
      {
        accept: "application/xml",
        "content-type": "application/atom+xml",
      }
    );
    expect(response.headers["content-type"]).toEqual("application/atom+xml;charset=utf-8");
    response.text = cleanResponse(response.text);
    expect(response.text).toMatchSnapshot();
  });

  it("DELETE request", async () => {
    let payload = fs.readFileSync(__dirname + "/_env/util/atom/Atom-POST.txt", "utf8");
    payload = payload.replace(/<d:ID>a/g, "<d:ID>c");
    payload = payload.replace(/\r\n/g, "");
    let response = await util.callWrite(request, "/v2/main/Header", payload, false, {
      accept: "application/xml",
      "content-type": "application/atom+xml",
    });
    expect(response.statusCode).toEqual(201);
    response = await util.callDelete(request, "/v2/main/Header(guid'c853cdb8-5531-4141-b319-d405ae5d1e63')", {
      accept: "application/xml",
      "content-type": "application/atom+xml",
    });
    expect(response.statusCode).toEqual(204);
    expect(response.headers["content-type"]).toEqual("application/xml;charset=utf-8");
    expect(response.text).toEqual("");
  });

  it("GET function", async () => {
    let response = await util.callRead(request, "/v2/main/unboundFunction?num=1&text=abc", {
      accept: "application/xml",
    });
    expect(response.headers["content-type"]).toEqual("application/atom+xml;charset=utf-8");
    response.text = cleanResponse(response.text);
    expect(response.text).toMatchSnapshot();

    response = await util.callRead(request, "/v2/main/unboundMassFunction?ids=TEST1", {
      accept: "application/xml",
    });
    expect(response.headers["content-type"]).toEqual("application/atom+xml;charset=utf-8");
    response.text = cleanResponse(response.text);
    expect(response.text).toMatchSnapshot();

    response = await util.callRead(request, "/v2/main/unboundFunctionPrimitive?num=1", {
      accept: "application/xml",
    });
    expect(response.headers["content-type"]).toEqual("application/atom+xml;charset=utf-8");
    response.text = cleanResponse(response.text);
    expect(response.text).toMatchSnapshot();

    response = await util.callRead(request, "/v2/main/unboundMassFunctionPrimitive?text1=abc&text2=def", {
      accept: "application/xml",
    });
    expect(response.headers["content-type"]).toEqual("application/atom+xml;charset=utf-8");
    response.text = cleanResponse(response.text);
    expect(response.text).toMatchSnapshot();

    response = await util.callRead(request, "/v2/main/unboundFunctionEntity?num=1&text=test", {
      accept: "application/xml",
    });
    expect(response.headers["content-type"]).toEqual("application/atom+xml;charset=utf-8");
    response.text = cleanResponse(response.text);
    expect(response.text).toMatchSnapshot();

    response = await util.callRead(request, "/v2/main/unboundMassFunctionEntity?ids=TEST1&ids='TEST2'", {
      accept: "application/xml",
    });
    expect(response.headers["content-type"]).toEqual("application/atom+xml;charset=utf-8");
    response.text = cleanResponse(response.text);
    expect(response.text).toMatchSnapshot();
  });

  it("POST action", async () => {
    let response = await util.callWrite(request, "/v2/main/unboundAction?num=1&text=abc", {}, false, {
      accept: "application/xml",
    });
    expect(response.headers["content-type"]).toEqual("application/atom+xml;charset=utf-8");
    response.text = cleanResponse(response.text);
    expect(response.text).toMatchSnapshot();

    response = await util.callWrite(request, "/v2/main/unboundMassAction?ids=TEST1", {}, false, {
      accept: "application/xml",
    });
    expect(response.headers["content-type"]).toEqual("application/atom+xml;charset=utf-8");
    response.text = cleanResponse(response.text);
    expect(response.text).toMatchSnapshot();

    response = await util.callWrite(request, "/v2/main/unboundActionPrimitive?num=1", {}, false, {
      accept: "application/xml",
    });
    expect(response.headers["content-type"]).toEqual("application/atom+xml;charset=utf-8");
    response.text = cleanResponse(response.text);
    expect(response.text).toMatchSnapshot();

    response = await util.callWrite(request, "/v2/main/unboundMassActionPrimitive?text1=abc&text2=def", {}, false, {
      accept: "application/xml",
    });
    expect(response.headers["content-type"]).toEqual("application/atom+xml;charset=utf-8");
    response.text = cleanResponse(response.text);
    expect(response.text).toMatchSnapshot();

    response = await util.callWrite(request, "/v2/main/unboundActionEntity?num=1&text=test", {}, false, {
      accept: "application/xml",
    });
    expect(response.headers["content-type"]).toEqual("application/atom+xml;charset=utf-8");
    response.text = cleanResponse(response.text);
    expect(response.text).toMatchSnapshot();

    response = await util.callWrite(request, "/v2/main/unboundMassActionEntity?ids=TEST1&ids='TEST2'", {}, false, {
      accept: "application/xml",
    });
    expect(response.headers["content-type"]).toEqual("application/atom+xml;charset=utf-8");
    response.text = cleanResponse(response.text);
    expect(response.text).toMatchSnapshot();
  });

  it("GET error response", async () => {
    let response = await util.callRead(
      request,
      "/v2/main/Header(guid'a0582b6a-6d93-46d9-bd28-98723a285d40')?$format=atom"
    );
    expect(response.text).toBeDefined();
    response.text = cleanResponse(response.text);
    expect(response.headers["content-type"]).toEqual("application/atom+xml;charset=utf-8");
    expect(response.text).toMatchSnapshot();

    response = await util.callRead(request, "/v2/main/Header(guid'a0582b6a-6d93-46d9-bd28-98723a285d40')", {
      accept: "application/xml",
    });
    expect(response.text).toBeDefined();
    response.text = cleanResponse(response.text);
    expect(response.headers["content-type"]).toEqual("application/atom+xml;charset=utf-8");
    expect(response.text).toMatchSnapshot();

    response = await util.callRead(request, "/v2/main/unboundErrorFunction", {
      accept: "application/xml",
    });
    expect(response.text).toBeDefined();
    response.text = cleanResponse(response.text);
    expect(response.headers["content-type"]).toEqual("application/atom+xml;charset=utf-8");
    expect(response.text).toMatchSnapshot();
  });

  it("GET batch request", async () => {
    const ID = "e0582b6a-6d93-46d9-bd28-98723a285d40";
    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-GET-Atom.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    payload = payload.replace(/{{ID}}/g, ID);
    let response = await util.callMultipart(request, "/v2/main/$batch", payload);
    expect(response.statusCode).toEqual(202);
    const responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(3);
    expect(responses.filter((response) => response.statusCode === 200).length).toEqual(3);
    const [first, second, third] = responses;
    expect(first.headers["content-type"]).toEqual("application/json");
    expect(first.body.d.results.length).toEqual(9);
    expect(first.contentTransferEncoding).toEqual("binary");
    expect(second.headers["content-type"]).toEqual("application/atom+xml;charset=utf-8");
    second.body = cleanResponse(second.body);
    expect(second.body).toMatchSnapshot();
    expect(second.contentTransferEncoding).toEqual("binary");
    expect(third.headers["content-type"]).toEqual("application/atom+xml;charset=utf-8");
    third.body = cleanResponse(third.body);
    expect(third.body).toMatchSnapshot();
    expect(third.contentTransferEncoding).toEqual("binary");
  });

  it("POST batch request", async () => {
    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-POST-Atom.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    payload = payload.replace(/<d:ID>a/g, "<d:ID>d");
    let response = await util.callMultipart(request, "/v2/main/$batch", payload);
    expect(response.statusCode).toEqual(202);
    const responses = util.splitMultipartResponse(response.body);
    expect(responses.length).toEqual(1);
    expect(responses.filter((response) => response.statusCode === 201).length).toEqual(1);
    const [first] = responses;
    expect(first.headers["content-type"]).toEqual("application/atom+xml;charset=utf-8");
    first.body = cleanResponse(first.body);
    expect(first.body).toMatchSnapshot();
    expect(first.contentTransferEncoding).toEqual("binary");
  });

  function cleanResponse(text) {
    return text
      .replace(/http:\/\/localhost:(\d*)\//g, "")
      .replace(/<updated>.*?<\/updated>/g, "<updated/>")
      .replace(/<d:createdAt .*?>.*?<\/d:createdAt>/g, "<d:createdAt/>")
      .replace(/<d:modifiedAt .*?>.*?<\/d:modifiedAt>/g, "<d:modifiedAt/>");
  }
});
