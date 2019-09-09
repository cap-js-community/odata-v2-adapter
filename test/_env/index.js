"use strict";

const express = require("express");
const http = require("http");
const cds = require("@sap/cds");

process.env.XS_APP_LOG_LEVEL = "debug";

const odatav2proxy = require("../../lib");

const db = cds.connect({
  kind: "sqlite",
  credentials: {
    database: ":memory:" // "./test/_env/test.db"
  }
});

module.exports = async (service, defaultPort, fnInit) => {
  let port = defaultPort || 0;
  const servicePath = `./test/_env/${service}`;
  const app = express();

  const srv = await cds.load(servicePath);
  await cds.deploy(srv);

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
        analytics: "test.AnalyticsService",
        todo: "todo.TodoService"
      }
    })
  );

  await cds.serve(servicePath).in(app);

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
