"use strict";

const cds = require("@sap/cds");
const cov2ap = require("../../../src");

let credentials = JSON.parse(process.env.HANA_DB_CREDENTIALS || null);
try {
  credentials = require("../db/default-services").hana[0].credentials;
} catch {}

cds.env.requires.db = {
  kind: "hana",
  credentials,
};

cds.on("bootstrap", (app) => {
  app.use(cov2ap({ target: "auto" }));
});

module.exports = cds.server;
