"use strict";

const fs = require("fs");
const supertest = require("supertest");
const cds = require("@sap/cds");

const util = require("../../util/request");
const Headers = require("./Header");

module.exports = async (context) => {
  await initBinary(context);
  await initData(context);
};

async function initData({ app }) {
  const request = supertest(app);
  const responses = await Promise.all(
    Headers.map(async (header) => {
      return await util.callWrite(request, `/odata/v4/main/Header`, header, false, {
        "content-type": "application/json;IEEE754Compatible=true",
      });
    })
  );
  console.log(
    "Test Instances: " +
      responses.filter((entry) => {
        return entry.statusCode === 201;
      }).length
  );
}

async function initBinary({ port }) {
  const file = fs.readFileSync(__dirname + "/assets/file.png");
  await cds.connect.to("db");
  await cds.run(
    INSERT.into("test.HeaderStream").entries({
      ID: "f8a7a4f7-1901-4032-a237-3fba1d1b2343",
      data: file,
      mediaType: "image/png",
      filename: "file.png",
    })
  );
  await cds.run(
    INSERT.into("test.HeaderStreamAttachment").entries({
      ID: "f8a7a4f7-1901-4032-a237-3fba1d1b2343",
      data: file,
      mediaType: "image/png",
      filename: "file.png",
    })
  );
  await cds.run(
    INSERT.into("test.HeaderUrlStream").entries([
      {
        ID: "f8a7a4f7-1901-4032-a237-3fba1d1b2343",
        link: `http://localhost:${port}/odata/v2/main/HeaderStream(guid'f8a7a4f7-1901-4032-a237-3fba1d1b2343')/$value`,
        mediaType: "image/png",
        filename: "file.png",
      },
      {
        ID: "e8a7a4f7-1901-4032-a237-3fba1d1b2343",
        link: `http://localhost:8888/odata/v2/main/HeaderStream(guid'f8a7a4f7-1901-4032-a237-3fba1d1b2343')/$value`,
        mediaType: "image/png",
        filename: "file.png",
      },
      {
        ID: "a8a7a4f7-1901-4032-a237-3fba1d1b2343",
        link: `http://localhost:${port}/odata/v2/main/HeaderStream(guid'f8a7a4f7-1901-4032-a237-3fba1d1b2343')/$value2`,
        mediaType: "image/png",
        filename: "file.png",
      },
    ])
  );
}
