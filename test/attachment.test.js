"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");
// eslint-disable-next-line no-restricted-modules
const fs = require("fs");

const util = require("./_env/util/request");

cds.test(__dirname + "/_env");

let request;

describe("attachment", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app.server);
  });

  it("POST attachment to attachment folder", async () => {
    let response = await util.callWrite(request, "/odata/v2/attachment/AttachmentFolder", {
      name: "Folder1",
    });
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    const folderId = response.body.d.ID;
    const file = fs.readFileSync(__dirname + "/_env/srv/init/assets/file.png");
    response = await util.callBinary(
      request,
      `/odata/v2/attachment/AttachmentFolder(guid'${folderId}')/attachments`,
      file,
      false,
      {
        "content-type": "image/png",
      },
    );
    expect(response.statusCode).toEqual(201);
    expect(response.body).toBeDefined();
    expect(response.body.d.ID).toBeDefined();
    const attachmentId = response.body.d.ID;
    expect(response.body.d).toEqual({
      ID: attachmentId,
      folder_ID: folderId,
      imageType: "image/png",
      folder: {
        __deferred: {
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost",
          )}/odata/v2/attachment/Attachment(guid'${attachmentId}')/folder`,
        },
      },
      __metadata: {
        type: "attachment.AttachmentService.Attachment",
        uri: `http://${response.request.host.replace(
          "127.0.0.1",
          "localhost",
        )}/odata/v2/attachment/Attachment(guid'${attachmentId}')`,
        media_src: `http://${response.request.host.replace(
          "127.0.0.1",
          "localhost",
        )}/odata/v2/attachment/Attachment(guid'${attachmentId}')/$value`,
        content_type: "image/png",
      },
    });
    response = await util.callRead(request, `/odata/v2/attachment/AttachmentFolder(guid'${folderId}')/attachments`);
    expect(response.statusCode).toEqual(200);
    expect(response.body).toBeDefined();
    expect(response.body.d).toEqual({
      results: [
        {
          ID: attachmentId,
          __metadata: {
            content_type: "image/png",
            media_src: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost",
            )}/odata/v2/attachment/Attachment(guid'${attachmentId}')/$value`,
            type: "attachment.AttachmentService.Attachment",
            uri: `http://${response.request.host.replace(
              "127.0.0.1",
              "localhost",
            )}/odata/v2/attachment/Attachment(guid'${attachmentId}')`,
          },
          folder: {
            __deferred: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost",
              )}/odata/v2/attachment/Attachment(guid'${attachmentId}')/folder`,
            },
          },
          folder_ID: folderId,
          imageType: "image/png",
        },
      ],
    });
    const readResponse = await util.callRead(request, `/odata/v2/attachment/Attachment(guid'${attachmentId}')/file`);
    expect(readResponse.statusCode).toEqual(200);
    expect(readResponse.headers["content-type"]).toEqual("image/png");
    expect(readResponse.body.length).toEqual(17686);
    expect(readResponse.body).toEqual(file);
  });
});
