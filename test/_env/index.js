"use strict";

const express = require("express");
const http = require("http");
const cds = require("@sap/cds");

process.env.XS_APP_LOG_LEVEL = "info"; // debug

const odatav2proxy = require("../../lib");

const db = cds.connect({
  kind: "sqlite",
  credentials: {
    database: ":memory:" // "./test/_env/test.db"
  }
});

module.exports = async (service, defaultPort, fnInit, options) => {
  let port = defaultPort || 0;
  const servicePath = `./test/_env/${service}`;
  const app = express();

  const srv = await cds.load(servicePath);
  await cds.deploy(srv);

  // Backend
  let server;
  await new Promise(resolve => {
    server = new http.Server(app);
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
      port: port
    })
  );

  await cds.serve(servicePath, options).in(app);

  const context = { port, server, app, cds, srv, db, tx: db.transaction() };
  if (fnInit) {
    await fnInit(context);
  }
  return context;
};

module.exports.end = context => {
  context.cds.disconnect();
  context.server.close();
};
