"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");

const util = require("./_env/util/request");

cds.test(__dirname + "/_env");

cds.env.cov2ap.excludeNonSelectedKeys = true;

let request;

describe("main-env", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app.server);
  });

  it("Exclude non-selected keys", async () => {
    let response = await util.callRead(request, "/odata/v2/main/Header?$expand=Items&$orderby=name asc&$top=1");
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(1);
    let ID = response.body.d.results[0].ID;
    expect(ID).toBeDefined();
    expect(response.body.d.results[0].__metadata.uri.includes(`Header(guid'${ID}')`)).toBe(true);
    let itemID = response.body.d.results[0].Items.results[0].ID;
    expect(itemID).toBeDefined();
    expect(response.body.d.results[0].Items.results[0].__metadata.uri.includes(`HeaderItem(guid'${itemID}')`)).toBe(
      true,
    );

    response = await util.callRead(
      request,
      `/odata/v2/main/Header(guid'${ID}')?$expand=Items&$select=ID,name,Items/ID,Items/name`,
    );
    expect(response.body).toBeDefined();
    ID = response.body.d.ID;
    expect(ID).toBeDefined();
    expect(response.body.d.__metadata.uri.includes(`Header(guid'${ID}')`)).toBe(true);
    itemID = response.body.d.Items.results[0].ID;
    expect(itemID).toBeDefined();
    expect(response.body.d.Items.results[0].__metadata.uri.includes(`HeaderItem(guid'${itemID}')`)).toBe(true);

    response = await util.callRead(request, `/odata/v2/main/Header(guid'${ID}')?$expand=Items&$select=name,Items/name`);
    expect(response.body).toBeDefined();
    expect(response.body.d.ID).not.toBeDefined();
    expect(response.body.d.__metadata.uri.includes(`Header(guid'${ID}')`)).toBe(true);
    expect(response.body.d.Items.results[0].ID).not.toBeDefined();
    expect(response.body.d.Items.results[0].__metadata.uri.includes(`HeaderItem(guid'${itemID}')`)).toBe(true);
  });
});
