"use strict";

const fs = require("fs");
const supertest = require("supertest");
const cds = require("@sap/cds");

const util = require("../../util/request");
const Headers = require("./Header");

module.exports = async (context) => {
  let mainPath = cds.services["test.MainService"].path;
  if (mainPath === "/") {
    mainPath = "";
  }
  await initData(context, mainPath);
  await initBinary(context, mainPath);
};

async function initData({ app }, mainPath) {
  const request = supertest(app);
  const responses = await Promise.all(
    Headers.map(async (header) => {
      return await util.callWrite(request, `${mainPath}/Header`, header, false, {
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

async function initBinary({ port }, mainPath) {
  await cds.connect.to("db");
  await cds.run(
    INSERT.into("test.HeaderStream").entries({
      ID: "f8a7a4f7-1901-4032-a237-3fba1d1b2343",
      data: fs.readFileSync(__dirname + "/assets/file.png"),
      mediaType: "image/png",
      filename: "file.png",
    })
  );
  await cds.run(
    INSERT.into("test.HeaderStreamAttachment").entries({
      ID: "f8a7a4f7-1901-4032-a237-3fba1d1b2343",
      data: fs.readFileSync(__dirname + "/assets/file.png"),
      mediaType: "image/png",
      filename: "file.png",
    })
  );
  await cds.run(
    INSERT.into("test.HeaderUrlStream").entries([
      {
        ID: "f8a7a4f7-1901-4032-a237-3fba1d1b2343",
        link: `http://localhost:${port}/v2${mainPath}/HeaderStream(guid'f8a7a4f7-1901-4032-a237-3fba1d1b2343')/$value`,
        mediaType: "image/png",
        filename: "file.png",
      },
      {
        ID: "e8a7a4f7-1901-4032-a237-3fba1d1b2343",
        link: `http://localhost:8888/v2${mainPath}/HeaderStream(guid'f8a7a4f7-1901-4032-a237-3fba1d1b2343')/$value`,
        mediaType: "image/png",
        filename: "file.png",
      },
      {
        ID: "a8a7a4f7-1901-4032-a237-3fba1d1b2343",
        link: `http://localhost:${port}/v2${mainPath}/HeaderStream(guid'f8a7a4f7-1901-4032-a237-3fba1d1b2343')/$value2`,
        mediaType: "image/png",
        filename: "file.png",
      },
    ])
  );
}
