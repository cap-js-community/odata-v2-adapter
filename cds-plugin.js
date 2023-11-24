"use strict";
const cds = require("@sap/cds");

const cov2ap = require("./src");

cds.env.cov2ap = cds.env.cov2ap || {};
cds.env.cov2ap.plugin = cds.env.cov2ap.plugin === undefined ? true : cds.env.cov2ap.plugin;
cds.env.cov2ap.build = cds.env.cov2ap.build === undefined ? true : cds.env.cov2ap.build;

if (cds.env.cov2ap.plugin) {
  cds.on("bootstrap", async (app) => {
    app.use(cov2ap());
  });
  if (cds.env.cov2ap.build && cds.build && cds.build.register) {
    cds.build.register("cov2ap", {
      impl: "@cap-js-community/odata-v2-adapter/src/build.js",
      taskDefaults: { src: cds.env.folders.srv },
    });
  }
}
