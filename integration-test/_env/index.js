'use strict';

const express = require('express');
const http = require('http');
const cds = require('@sap/cds');
const odatav2proxy = require('../../');

process.env.XS_APP_LOG_LEVEL = 'debug';

const hana = require('./db/default-services').hana[0].credentials;
delete hana.url;

const db = cds.connect(Object.assign({
    kind: 'hana'
}, hana));

module.exports = async (service, defaultPort, fnInit) => {
    let port = defaultPort || 0;
    const servicePath = `./integration-test/_env/${service}`;
    const app = express();

    const srv = await cds.load(servicePath);
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
            path: 'v2',
            model: servicePath,
            port: port,
            services: {
                main: 'test.MainService'
            }
        })
    );

    const context = {port, app, cds, srv, db, tx: db.transaction()};
    if (fnInit) {
        await fnInit(context);
    }
    return context;
};

module.exports.end = context => {
    context.cds.disconnect();
    context.app.close();
};
