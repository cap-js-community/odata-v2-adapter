"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");
const fs = require("fs");

const env = require("./_env");
const util = require("./_env/util");

let request;

describe("auth-request", () => {
  beforeAll(async () => {
    const context = await env("auditmodel");
    request = supertest(context.app);
  });

  afterAll(async () => {
    await env.end();
  });

  it("POST audit ", async () => {
    let response = await util.callWrite(request, "/v2/audit/Audits", {
      audit_type_ID: 1,
      work_activity_ID: 1,
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    const id = response.body.d.ID;
    expect(id).toBeDefined();
    expect(response.body.d).toMatchObject({
      ID: id,
      start_date: null,
      end_date: null,
      auditor: null,
      audit_status: null,
      review_status: null,
      audit_type_ID: 1,
      work_activity_ID: 1,
      audit_type: {
        __deferred: {
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost"
          )}/v2/audit/Audits(guid'${id}')/audit_type`,
        },
      },
      work_activity: {
        __deferred: {
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost"
          )}/v2/audit/Audits(guid'${id}')/work_activity`,
        },
      },
      __metadata: {
        uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/v2/audit/Audits(guid'${id}')`,
        type: "audit.AuditService.Audits",
      },
    });
  });

  it("POST audit in batch", async () => {
    const requestBoundary = "batch_709b8b9352ac4342a0efb1e012d_1";
    let payload = fs.readFileSync("./test/_env/data/batch/Batch-POST-Audit.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    let response = await util.callMultipart(request, "/v2/audit/$batch", payload, requestBoundary);
    expect(response.statusCode).toEqual(202);

    const responseBoundary = response.headers["content-type"].split("boundary=")[1];
    const responses = util.splitMultipartResponse(response.body, responseBoundary);
    expect(responses.length).toEqual(1);
    const [first] = responses;
    first.forEach((part) => {
      expect(part.statusCode).toEqual(201);
      expect(part.contentTransferEncoding).toEqual("binary");
      expect(part.body).toBeDefined();
      expect(part.body.d).toBeDefined();
      const id = part.body.d.ID;
      expect(id).toBeDefined();
      expect(part.body.d).toMatchObject({
        ID: id,
        start_date: null,
        end_date: null,
        auditor: null,
        audit_status: null,
        review_status: null,
        audit_type_ID: 1,
        work_activity_ID: 1,
        audit_type: {
          __deferred: {
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost"
            )}/v2/audit/Audits(guid'${id}')/audit_type`,
          },
        },
        work_activity: {
          __deferred: {
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost"
            )}/v2/audit/Audits(guid'${id}')/work_activity`,
          },
        },
        __metadata: {
          uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/v2/audit/Audits(guid'${id}')`,
          type: "audit.AuditService.Audits",
        },
      });
    });
  });
});
