"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");

const util = require("./_env/util/request");

cds.test(__dirname + "/_env");

let request;

describe("hierarchy", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app.server);
  });

  it("GET hierarchy data", async () => {
    let response = await util.callRead(
      request,
      "/odata/v2/main/Node?$filter=hierarchyLevel eq 0&$select=description,nodeID,hierarchyLevel,parentNodeID,drillState&$skip=0&$top=157&$inlinecount=allpages",
      {
        accept: "application/json",
      },
    );
    expect(response.body).toMatchObject({
      d: {
        __count: "3",
        results: [
          {
            __metadata: {
              type: "test.MainService.Node",
              uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Node(1)`,
            },
            description: "1",
            drillState: "expanded",
            hierarchyLevel: 0,
            nodeID: 1,
            parentNodeID: "null",
          },
          {
            __metadata: {
              type: "test.MainService.Node",
              uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Node(2)`,
            },
            description: "2",
            drillState: "expanded",
            hierarchyLevel: 0,
            nodeID: 2,
            parentNodeID: "null",
          },
          {
            __metadata: {
              type: "test.MainService.Node",
              uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Node(3)`,
            },
            description: "3",
            drillState: "expanded",
            hierarchyLevel: 0,
            nodeID: 3,
            parentNodeID: "null",
          },
        ],
      },
    });
    response = await util.callRead(
      request,
      "/odata/v2/main/Node?$filter=parentNodeID eq 1&$select=description,nodeID,hierarchyLevel,parentNodeID,drillState&$skip=0&$top=157&$inlinecount=allpages",
      {
        accept: "application/json",
      },
    );
    expect(response.body).toMatchObject({
      d: {
        __count: "2",
        results: [
          {
            __metadata: {
              type: "test.MainService.Node",
              uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Node(4)`,
            },
            description: "1.1",
            drillState: "leaf",
            hierarchyLevel: 1,
            nodeID: 4,
            parentNodeID: 1,
          },
          {
            __metadata: {
              type: "test.MainService.Node",
              uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Node(5)`,
            },
            description: "1.2",
            drillState: "expanded",
            hierarchyLevel: 1,
            nodeID: 5,
            parentNodeID: 1,
          },
        ],
      },
    });
  });

  it("GET hierarchy data with filter", async () => {
    let response = await util.callRead(
      request,
      "/odata/v2/main/Node?$filter=hierarchyLevel eq 0 and (startswith(description,'1'))&$select=description,nodeID,hierarchyLevel,parentNodeID,drillState&$skip=0&$top=157&$inlinecount=allpages",
      {
        accept: "application/json",
      },
    );
    expect(response.body).toMatchObject({
      d: {
        __count: "1",
        results: [
          {
            __metadata: {
              type: "test.MainService.Node",
              uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Node(1)`,
            },
            description: "1",
            drillState: "expanded",
            hierarchyLevel: 0,
            nodeID: 1,
            parentNodeID: "null",
          },
        ],
      },
    });
    response = await util.callRead(
      request,
      "/odata/v2/main/Node?$filter=parentNodeID eq 1 and (startswith(description,'1'))&$select=description,nodeID,hierarchyLevel,parentNodeID,drillState&$skip=0&$top=157&$inlinecount=allpages",
      {
        accept: "application/json",
      },
    );
    expect(response.body).toMatchObject({
      d: {
        __count: "2",
        results: [
          {
            __metadata: {
              type: "test.MainService.Node",
              uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Node(4)`,
            },
            description: "1.1",
            drillState: "leaf",
            hierarchyLevel: 1,
            nodeID: 4,
            parentNodeID: 1,
          },
          {
            __metadata: {
              type: "test.MainService.Node",
              uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/main/Node(5)`,
            },
            description: "1.2",
            drillState: "expanded",
            hierarchyLevel: 1,
            nodeID: 5,
            parentNodeID: 1,
          },
        ],
      },
    });
  });
});
