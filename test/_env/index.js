"use strict";

const express = require("express");
const compression = require("compression");
const http = require("http");
const cds = require("@sap/cds");

const odatav2proxy = require("../../lib");

let context = null;

module.exports = async (service, defaultPort, fnInit, options) => {
  const db = await cds.connect.to("db", {
    kind: "sqlite",
    credentials: {
      database: ":memory:", // "./test/_env/test.db"
    },
  });

  let port = defaultPort || 0;
  const servicePath = `./test/_env/${service}`;
  const app = express();
  app.use(compression());

  const srv = await cds.load(servicePath);
  await cds.deploy(srv);

  // Backend
  let server;
  await new Promise((resolve) => {
    server = new http.Server(app);
    server.listen(port, () => {
      port = server.address().port;
      // eslint-disable-next-line no-console
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
    })
  );

  await cds.serve(servicePath, options).in(app);
  // Single root service
  /*await cds.serve("MainService")
    .from("./test/_env/model")
    .at("/")
    .in(app);*/

  context = { port, server, app, cds, srv, db };
  if (fnInit) {
    await fnInit(context);
  }
  return context;
};

module.exports.end = async () => {
  await context.cds.disconnect();
  context.server.close();
  context = null;
};
