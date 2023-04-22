"use strict";
const cds = require("@sap/cds");

const cov2ap = require("./src");

if (cds.env.cov2ap && cds.env.cov2ap.plugin) {
  cds.on("bootstrap", async (app) => {
    app.use(cov2ap());
  });
}
