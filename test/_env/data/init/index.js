const fs = require("fs");
const supertest = require("supertest");
const cds = require("@sap/cds");

const util = require("../../util");
const Headers = require("./Header");

module.exports = async ({ app }) => {
  await initData(app);
  await initBinary(app);
};

async function initData(app) {
  const request = supertest(app);
  const responses = await Promise.all(
    Headers.map(async header => {
      return await util.callWrite(request, "/main/Header", header, false, {
        "content-type": "application/json;IEEE754Compatible=true"
      });
    })
  );
  console.log("Test Instances: " + responses.length);
}

async function initBinary(app) {
  await cds.connect();
  await cds.run(
    INSERT.into("test.HeaderStream")
      .columns("ID", "data")
      .rows([["f8a7a4f7-1901-4032-a237-3fba1d1b2343", fs.readFileSync("./test/_env/data/init/assets/file.png")]])
  );
}
