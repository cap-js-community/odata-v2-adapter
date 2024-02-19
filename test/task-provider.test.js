"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");

const util = require("./_env/util/request");

cds.test(__dirname + "/_env");

let request;

describe("task-provider", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app.server);
  });

  it("Index page including V2 links", async () => {
    expect(cds.services["test.MainService"].$linkProviders.length).toEqual(2);
    const provider = cds.services["test.TaskProviderService"].$linkProviders[0];
    const link = provider("tasks");
    expect(link).toEqual({
      href: "/task-provider/v2/tasks",
      name: "tasks (V2)",
      title: "OData V2",
    });
  });

  it("GET service via default path", async () => {
    const response = await util.callRead(request, "/odata/v2/task-provider", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        EntitySets: ["tasks"],
      },
    });
  });

  it("GET service data via default path", async () => {
    const response = await util.callRead(request, "/odata/v2/task-provider/tasks", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length > 0).toEqual(true);
    expect(response.body.d.results[0].urn).toEqual("urn:sap.odm.bpm.task:4711:task-approval$ea99df92-6225-4d75-bbd0-9b11f73c7f60");
    expect(response.body.d.results[0].__metadata).toEqual({
      type: "test.TaskProviderService.tasks",
      uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/task-provider/tasks('urn:sap.odm.bpm.task:4711:task-approval%24ea99df92-6225-4d75-bbd0-9b11f73c7f60')`
    });
  });

  it("GET service via protocl odata-v2 path", async () => {
    const response = await util.callRead(request, "/task-provider/v2", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        EntitySets: ["tasks"],
      },
    });
  });

  it("GET service data via protocol odata-v2 path", async () => {
    const response = await util.callRead(request, "/task-provider/v2/tasks", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length > 0).toEqual(true);
    expect(response.body.d.results[0].urn).toEqual("urn:sap.odm.bpm.task:4711:task-approval$ea99df92-6225-4d75-bbd0-9b11f73c7f60");
    expect(response.body.d.results[0].__metadata).toEqual({
      type: "test.TaskProviderService.tasks",
      uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/task-provider/v2/tasks('urn:sap.odm.bpm.task:4711:task-approval%24ea99df92-6225-4d75-bbd0-9b11f73c7f60')`
    });
  });

});
