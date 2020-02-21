"use strict";

const fs = require("fs");
const supertest = require("supertest");

const env = require("./_env");
const util = require("./_env/util");

let context;
let request;

describe("draft-request", () => {
  beforeAll(async () => {
    context = await env("draftmodel");
    request = supertest(context.app);
  });

  afterAll(() => {
    env.end(context);
  });

  it("GET service", async () => {
    const response = await util.callRead(request, "/v2/draft", {
      accept: "application/json"
    });
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        EntitySets: ["Header", "HeaderItem"]
      }
    });
  });

  it("GET $metadata", async () => {
    const response = await util.callRead(request, "/v2/draft/$metadata", {
      accept: "application/xml"
    });
    expect(response.body).toBeDefined();
    expect(response.text).toMatchSnapshot();
  });

  it("GET request", async () => {
    let response = await util.callRead(request, "/v2/draft/Header");
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(0);
    response = await util.callRead(request, "/v2/draft/Header?$inlinecount=allpages");
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(0);
    expect(response.body.d.__count).toEqual("0");
  });

  it("GET request with parameters", async () => {
    let response = await util.callWrite(request, "/v2/draft/Header", {
      name: "Test"
    });
    expect(response.statusCode).toEqual(201);
    const id = response.body.d.ID;
    const etag = response.body.d.__metadata.etag;
    expect(typeof etag).toEqual("string");
    response = await util.callRead(request, `/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.body).toBeDefined();
    expect(response.body.d).toMatchObject({
      __metadata: {
        uri: `http://${response.request.host}/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`,
        type: "test.DraftService.Header",
        etag: etag
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
          uri: `http://${response.request.host}/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/Items`
        }
      },
      SiblingEntity: {
        __deferred: {
          uri: `http://${response.request.host}/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/SiblingEntity`
        }
      },
      DraftAdministrativeData: {
        __deferred: {
          uri: `http://${response.request.host}/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/DraftAdministrativeData`
        }
      }
    });
    response = await util.callRead(
      request,
      `/v2/draft/Header?$filter=ID eq guid'${id}' and IsActiveEntity eq false&$select=ID,name&$expand=Items&$skip=0&$top=1&$orderby=name asc`
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(1);
    expect(response.body.d.results[0].__metadata.etag).toEqual(etag);
  });

  it("POST request", async () => {
    let response = await util.callWrite(request, "/v2/draft/Header", {
      name: "Test Create"
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
          uri: `http://${response.request.host}/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`,
          type: "test.DraftService.Header",
          etag: etag
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
            uri: `http://${response.request.host}/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/Items`
          }
        },
        SiblingEntity: {
          __deferred: {
            uri: `http://${response.request.host}/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/SiblingEntity`
          }
        },
        DraftAdministrativeData: {
          __deferred: {
            uri: `http://${response.request.host}/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/DraftAdministrativeData`
          }
        }
      }
    });
    response = await util.callRead(request, "/v2/draft/Header?$filter=name eq 'Test Create'");
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(0); // No Active
    response = await util.callRead(request, `/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          uri: `http://${response.request.host}/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`,
          type: "test.DraftService.Header",
          etag: etag
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
            uri: `http://${response.request.host}/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/Items`
          }
        },
        SiblingEntity: {
          __deferred: {
            uri: `http://${response.request.host}/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/SiblingEntity`
          }
        },
        DraftAdministrativeData: {
          __deferred: {
            uri: `http://${response.request.host}/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/DraftAdministrativeData`
          }
        }
      }
    });
    response = await util.callRead(request, `/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/Items`);
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toHaveLength(0);
    response = await util.callWrite(request, `/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/Items`, {
      name: "Test Update"
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
          uri: `http://${response.request.host}/v2/draft/HeaderItem(ID=guid'${itemId}',IsActiveEntity=false)`
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
            uri: `http://${response.request.host}/v2/draft/HeaderItem(ID=guid'${itemId}',IsActiveEntity=false)/header`
          }
        },
        SiblingEntity: {
          __deferred: {
            uri: `http://${response.request.host}/v2/draft/HeaderItem(ID=guid'${itemId}',IsActiveEntity=false)/SiblingEntity`
          }
        },
        DraftAdministrativeData: {
          __deferred: {
            uri: `http://${response.request.host}/v2/draft/HeaderItem(ID=guid'${itemId}',IsActiveEntity=false)/DraftAdministrativeData`
          }
        }
      }
    });
    response = await util.callRead(
      request,
      `/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/Items(ID=guid'${itemId}',IsActiveEntity=false)`
    );
    expect(response.body).toBeDefined();
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          type: "test.DraftService.HeaderItem",
          uri: `http://${response.request.host}/v2/draft/HeaderItem(ID=guid'${itemId}',IsActiveEntity=false)`
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
            uri: `http://${response.request.host}/v2/draft/HeaderItem(ID=guid'${itemId}',IsActiveEntity=false)/header`
          }
        },
        SiblingEntity: {
          __deferred: {
            uri: `http://${response.request.host}/v2/draft/HeaderItem(ID=guid'${itemId}',IsActiveEntity=false)/SiblingEntity`
          }
        },
        DraftAdministrativeData: {
          __deferred: {
            uri: `http://${response.request.host}/v2/draft/HeaderItem(ID=guid'${itemId}',IsActiveEntity=false)/DraftAdministrativeData`
          }
        }
      }
    });
  });

  it("PUT request", async () => {
    let response = await util.callWrite(request, "/v2/draft/Header", {
      name: "Test"
    });
    expect(response.body).toBeDefined();
    expect(response.statusCode).toEqual(201);
    const etag = response.body.d.__metadata.etag;
    expect(typeof etag).toEqual("string");
    const id = response.body.d.ID;
    response = await util.callWrite(
      request,
      `/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`,
      {
        name: "Test2"
      },
      true
    );
    expect(response.statusCode).toEqual(428);
    response = await util.callWrite(
      request,
      `/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`,
      {
        name: "Test2"
      },
      true,
      {
        "If-Match": etag
      }
    );
    expect(response.statusCode).toEqual(200);
    response = await util.callRead(request, `/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.body).toMatchObject({
      d: {
        __metadata: {
          uri: `http://${response.request.host}/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`,
          type: "test.DraftService.Header"
        },
        createdBy: "anonymous",
        modifiedBy: "anonymous",
        name: "Test2",
        description: null,
        Items: {
          __deferred: {
            uri: `http://${response.request.host}/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)/Items`
          }
        }
      }
    });
    response = await util.callWrite(
      request,
      "/v2/draft/Header",
      {
        name: "Test"
      },
      true
    );
    expect(response.body).toMatchObject({
      error: {
        code: "null",
        message: {
          lang: "en",
          value: "Method PATCH not allowed for ENTITY.COLLECTION"
        }
      }
    });
  });

  it("DELETE request", async () => {
    let response = await util.callWrite(request, "/v2/draft/Header", {
      name: "Test"
    });
    expect(response.body).toBeDefined();
    const id = response.body.d.ID;
    const etag = response.body.d.__metadata.etag;
    response = await util.callDelete(request, `/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`, {
      "If-Match": etag
    });
    expect(response.statusCode).toEqual(204);
    response = await util.callRead(request, `/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.statusCode).toEqual(404);
    response = await util.callDelete(request, `/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`, {
      "If-Match": "*"
    });
    expect(response.statusCode).toEqual(404);
    expect(response.body).toMatchObject({
      error: {
        code: "404",
        message: {
          lang: "en",
          value: "Not Found"
        }
      }
    });
  });

  it("POST activate request", async () => {
    let response = await util.callWrite(request, "/v2/draft/Header", {
      name: "Test Create"
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    const id = response.body.d.ID;
    let etag = response.body.d.__metadata.etag;
    response = await util.callRead(request, `/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.body).toBeDefined();
    expect(response.body.d.ID).toEqual(id);
    response = await util.callRead(request, `/v2/draft/Header(ID=guid'${id}',IsActiveEntity=true)`);
    expect(response.statusCode).toEqual(404);
    response = await util.callWrite(
      request,
      `/v2/draft/Header_draftPrepare?ID=guid'${id}'&IsActiveEntity=false`,
      {},
      false,
      {
        "If-Match": etag
      }
    );
    expect(response.statusCode).toEqual(200);
    response = await util.callWrite(
      request,
      `/v2/draft/Header_draftActivate?ID=guid'${id}'&IsActiveEntity=false`,
      {},
      false,
      {
        "If-Match": etag
      }
    );
    expect(response.statusCode).toEqual(201);
    etag = response.body.d.__metadata.etag;
    // expect(etag).toBeDefined(); // TODO odata-server/issues/84
    response = await util.callRead(request, `/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.statusCode).toEqual(404);
    response = await util.callRead(request, `/v2/draft/Header(ID=guid'${id}',IsActiveEntity=true)`);
    expect(response.statusCode).toEqual(200);
    expect(response.body.d.ID).toEqual(id);
    etag = response.body.d.__metadata.etag;
    response = await util.callWrite(
      request,
      `/v2/draft/Header_draftEdit?ID=guid'${id}'&IsActiveEntity=true`,
      {},
      false,
      {
        "If-Match": etag
      }
    );
    expect(response.statusCode).toEqual(201);
    response = await util.callRead(request, `/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.statusCode).toEqual(200);
    expect(response.body.d.ID).toEqual(id);
  });

  it("DELETE draft request", async () => {
    let response = await util.callWrite(request, "/v2/draft/Header", {
      name: "Test Create"
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    const id = response.body.d.ID;
    response = await util.callRead(request, `/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.body).toBeDefined();
    expect(response.body.d.ID).toEqual(id);
    response = await util.callDelete(request, `/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`, {
      "If-Match": "*"
    });
    expect(response.statusCode).toEqual(204);
    response = await util.callRead(request, `/v2/draft/Header(ID=guid'${id}',IsActiveEntity=false)`);
    expect(response.statusCode).toEqual(404);
  });
});
