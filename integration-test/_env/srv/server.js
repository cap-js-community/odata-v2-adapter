"use strict";

const cds = require("@sap/cds");
const proxy = require("../../../lib");

const credentials = require("../db/default-services").hana[0].credentials;

cds.env.requires.db = {
  kind: "hana",
  credentials,
};

cds.on("bootstrap", (app) => app.use(proxy()));

module.exports = cds.server;
