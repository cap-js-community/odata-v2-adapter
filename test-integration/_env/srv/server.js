"use strict";

const cds = require("@sap/cds");
const cov2ap = require("../../../src");

const credentials = require("../db/default-services").hana[0].credentials;

cds.env.requires.db = {
  kind: "hana",
  credentials,
};

cds.on("bootstrap", (app) => {
  app.use(cov2ap({ target: "auto" }));
});

module.exports = cds.server;
