"use strict";

const cds = require("@sap/cds");
const proxy = require("../lib");

const init = require("../test/_env/data/init");

let app;

cds.on("bootstrap", (_app) => {
  app = _app;
  app.use(proxy())
});

cds.on("served", (services) => {
});

cds.on("listening", (server) => {
  init({ app })
});

module.exports = cds.server;
