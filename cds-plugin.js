"use strict";

const cds = require("@sap/cds");
const path = require("path");

const cov2ap = require("./src");

const PLUGIN = "@cap-js-community/odata-v2-adapter";
const PLUGIN_CONFIG = [PLUGIN, `${PLUGIN}/cds-plugin`, `${PLUGIN}/cds-plugin.js`];

const packageJSON = require(path.join(process.cwd(), "package.json"));
const pluginActive =
  (cds.env.cov2ap && cds.env.cov2ap.plugin) ||
  (packageJSON &&
    packageJSON.cds &&
    packageJSON.cds.plugins &&
    !!packageJSON.cds.plugins.find((plugin) => PLUGIN_CONFIG.includes(plugin) || PLUGIN_CONFIG.includes(plugin.impl)));

if (pluginActive) {
  cds.on("bootstrap", async (app) => {
    app.use(cov2ap());
  });
}
