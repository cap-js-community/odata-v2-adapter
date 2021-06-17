"use strict";

const cds = require("@sap/cds");
const proxy = require("../lib");
const compression = require("compression");

const init = require("../test/_env/data/init");

cds.on("bootstrap", (app) => {
  app.use(compression({ filter: shouldCompress }));
  app.use(proxy());
});

cds.on("served", (services) => {});

cds.on("listening", (server) => {
  init({ app: cds.app });
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
