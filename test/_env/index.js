"use strict";

const express = require("express");
const http = require("http");
const cds = require("@sap/cds");

process.env.XS_APP_LOG_LEVEL = "debug";

const odatav2proxy = require("../../lib");

const db = cds.connect({
  kind: "sqlite",
  credentials: {
    database: ":memory:"
  }
});

module.exports = async (service, defaultPort, fnInit) => {
  let port = defaultPort || 0;
  const servicePath = `./test/_env/${service}`;
  const app = express();

  const srv = await cds.load(servicePath);
  await cds.deploy(srv);
  await cds.serve(servicePath).in(app);

  // Backend
  await new Promise(resolve => {
    const server = new http.Server(app);
    server.listen(port, () => {
      port = server.address().port;
      console.info(`Server listening on port ${port}`);
      resolve();
    });
  });

  // Proxy
  app.use(
    odatav2proxy({
      path: "v2",
      model: servicePath,
      port: port,
      services: {
        main: "test.MainService",
        draft: "test.DraftService",
        analytics: "test.AnalyticsService"
      }
    })
  );

  const context = { port, app, cds, srv, db, tx: db.transaction() };
  if (fnInit) {
    await fnInit(context);
  }
  return context;
};

module.exports.end = context => {
  context.cds.disconnect();
  context.app.close();
};
