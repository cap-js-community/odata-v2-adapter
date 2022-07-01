"use strict";

const cds = require("@sap/cds");
const proxy = require("../../../src");

const credentials = require("../db/default-services").hana[0].credentials;

cds.env.requires.db = {
  kind: "hana",
  credentials,
};

cds.on("bootstrap", (app) => {
  app.use(proxy({ target: "auto" }));
});

module.exports = cds.server;
