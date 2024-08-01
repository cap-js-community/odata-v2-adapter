"use strict";

const cds = require("@sap/cds");

let credentials = JSON.parse(process.env.HANA_DB_CREDENTIALS || null);
try {
  credentials = require("../db/default-services").hana[0].credentials;
} catch {
  // ignore
}

cds.env.requires.db = {
  kind: "hana",
  credentials,
};

module.exports = cds.server;
