"use strict";

const cds = require("@sap/cds");
const proxy = require("../lib");

cds.on("bootstrap", (app) => app.use(proxy()));

module.exports = cds.server;
