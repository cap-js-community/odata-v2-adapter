"use strict";

const cds = require("@sap/cds");
const compression = require("compression");

const init = require("./init");

cds.on("bootstrap", (app) => {
  const before = [];
  if (!(process.env.TEST_COV2AP_COMPRESSION === "false")) {
    before.push(compression({ filter: shouldCompress }));
  }
  if (!(process.env.TEST_COV2AP_FEATURE_TOGGLES === "false")) {
    before.push((req, res, next) => {
      req.features = req.features || ["advanced"];
      next();
    });
  }
  cds.cov2ap.before = before;
});

cds.on("listening", ({ server }) => {
  global._init = init({
    app: cds.app,
    port: server.address().port,
  });
});

function shouldCompress(req, res) {
  const type = res.getHeader("Content-Type");
  if (type && typeof type === "string" && type.startsWith("multipart/mixed")) {
    return true;
  }
  // fallback to standard filter function
  return compression.filter(req, res);
}

module.exports = cds.server;
