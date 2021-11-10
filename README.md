# @sap/cds-odata-v2-adapter-proxy (cov2ap)

[CDS OData V2 Adapter Proxy](https://www.npmjs.com/package/@sap/cds-odata-v2-adapter-proxy) for [CDS OData V4 Services](https://cap.cloud.sap/docs/).

Exposes a full-fledged OData V2 service, converting OData V2 requests to CDS OData V4 service calls and responses back to OData V2.

Runs in context of the [SAP Cloud Application Programming Model (CAP)](https://cap.cloud.sap/docs/)
using CDS Node.js module [@sap/cds](https://www.npmjs.com/package/@sap/cds) or CDS Java modules
[com.sap.cds](https://mvnrepository.com/artifact/com.sap.cds).

## Getting Started

- Clone repository
- Unit Tests: `npm test`
- Test Server: `npm start`
  - Service: `http://localhost:4004/v2/main`
  - Metadata: `http://localhost:4004/v2/main/$metadata`
  - Data: `http://localhost:4004/v2/main/Header?$expand=Items`

> Code repository is only available SAP internal.

## Usage

### CDS Combined Backend (CAP Node.js) - Integrated

In your existing `@sap/cds` project:

- Run `npm install @sap/cds-odata-v2-adapter-proxy -s`
- Create new file `server.js` in the service folder `srv` of your project: `./srv/server.js`

```
const cds = require("@sap/cds");
const proxy = require("@sap/cds-odata-v2-adapter-proxy");
cds.on("bootstrap", app => app.use(proxy()));
module.exports = cds.server;
```

- Run `cds run` from the project root to start the server:
  - OData V2 service will be available at http://localhost:4004/v2/<service-path>
  - OData V4 service will be available at http://localhost:4004/<service-path>

Note that `@sap/cds` is a peer dependency and needs to be available as module as well.

### CDS Combined Backend (CAP Node.js) - Custom

In your existing `@sap/cds` project:

- Run `npm install @sap/cds-odata-v2-adapter-proxy -s`
- Create new file `index.js` in the service folder `srv` of your project: `./srv/index.js`

```
const express = require("express");
const cds = require("@sap/cds");
const proxy = require("@sap/cds-odata-v2-adapter-proxy");

const host = "0.0.0.0";
const port = process.env.PORT || 4004;

(async () => {
  const app = express();

  // OData V2
  app.use(proxy());

  // OData V4
  await cds.connect("db").serve("all").in(app);

  const server = app.listen(port, host, () => console.info(`app is listing at ${host}:${port}`));
  server.on("error", error => console.error(error.stack));
})();
```

- Run `node srv/index` from the project root to start the server:
  - OData V2 service will be available at http://localhost:4004/v2/<service-path>
  - OData V4 service will be available at http://localhost:4004/<service-path>

Note that `@sap/cds` is a peer dependency and needs to be available as module as well.

### CDS Standalone Backend (CAP Node.js or CAP Java)

> For CAP Java projects prefer the Native OData V2 Adapter ([com.sap.cds/cds-adapter-odata-v2](https://mvnrepository.com/artifact/com.sap.cds/cds-adapter-odata-v2)).

In a new Node.js express project:

- Run `npm install @sap/cds -s`
- Run `npm install @sap/cds-odata-v2-adapter-proxy -s`
- Place CDS models in `db` and `srv` model folders or provide a generated CSN
- Create a new file `index.js` in the service folder `srv` of the project: `./srv/index.js`

```
const express = require("express");
const proxy = require("@sap/cds-odata-v2-adapter-proxy");

const host = "0.0.0.0";
const port = process.env.PORT || 4004;

(async () => {
  const app = express();

  // OData V2
  app.use(proxy({
    target: "<odata-v4-backend-url>", // locally e.g. http://localhost:8080
    services: {
      "<odata-v4-service-path>": "<qualified.ServiceName>"
    }
  }));

  const server = app.listen(port, host, () => console.info(`app is listing at ${host}:${port}`));
  server.on("error", error => console.error(error.stack));
})();
```

- A deployed version of CDS OData V2 Adapter Proxy shall have option `target` set to the deployed OData V4 backend URL.
  This can be retrieved from the Cloud Foundry environment using `process.env`, for example,
  from the `destinations` environment variable. Locally e.g. http://localhost:8080 can be used.
- In proxy option `services`, every OData V4 service URL path needs to mapped to
  the corresponding fully qualified CDS service name, e.g. `"/odata/v4/MainService/": "test.MainService"`,
  to establish the back-link connection between OData URL and its CDS service.
- Make sure, that your CDS models are also available in the project.
  Those reside either in `db` and `srv` folders, or a compiled (untransformed) `srv.json` is provided.
  This can be generated by using the following command:

  ```
  cds srv -s all -o .
  ```

- Alternatively, a `cds build` can be triggered as described in section "Cloud Foundry Deployment".
- If not detected automatically, the model path can be set with option `model` (especially if `csn.json`/`srv.json` option is used).
- Make sure, that all i18n property files reside next to the `csn.json` in a `i18n` or `_i18n` folder, to be detected by localization.
- In a multitenant scenario in combination with a standalone proxy, the CDS model can be retrieved remotely via MTX endpoint (`mtxEndpoint`) by setting proxy option `mtxRemote: true`.
- Proxy option `mtxEndpoint` can be specified as absolute url (starting with `http://` or `https://`), to be able to address MTX Sidecar
  possibly available under a target different from OData v4 backend URL. If not specified absolutely, proxy `target` is prepended to `mtxEndpoint`.

- Run `node srv/index` from the project root to start the server:
  - OData V2 service will be available at http://localhost:4004/v2/<odata-v4-service-path>
  - OData V4 service shall be available at http://localhost:8080/<odata-v4-service-path>

Note that `@sap/cds` is a peer dependency and needs to be available as module as well.

## Cloud Foundry Deployment

When deploying the CDS OData V2 Adapter Proxy to Cloud Foundry, make sure that it has access to the whole CDS model.
Especially, it’s the case, that normally the Node.js server is only based on folder `srv` and folder `db` is then missing on Cloud Foundry.

To come around this situation, trigger a `cds build` during development time, that generates a `csn.json` at location `gen/srv/srv/csn.json`.
Point your Cloud Foundry deployment of the CDS OData V2 Adapter Proxy to the folder `gen/srv` (using manifest.json or MTA), so that
the CDS models can be found via file `srv/csn.json`, during runtime execution on Cloud Foundry.

Make sure, that all i18n property files reside next to the `csn.json` in a `i18n` or `_i18n` folder, to be detected by localization.

## SAP Fiori Elements V2

The OData V2 service provided by the CDS OData V2 Adapter Proxy can be used to serve an SAP Fiori Elements V2 UI.

A running example can be tested as follows:

- Clone repository
- Start server: `npm run cds:run`
- Open Fiori Launchpad:
  http://localhost:4004/webapp/test/flpSandbox.html

> Code repository is only available SAP internal.

## Compression

Response compressions can be enabled, by registering the `compression` Node.js
module in Express app at bootstrap time, e.g. in `srv/server.js`:

```
const cds = require("@sap/cds");
const proxy = require("@sap/cds-odata-v2-adapter-proxy");
const compression = require("compression");

cds.on("bootstrap", (app) => {
  app.use(compression({ filter: shouldCompress }));
  app.use(proxy());
});

function shouldCompress(req, res) {
  const type = res.getHeader("Content-Type");
  if (type && typeof type === "string" && type.startsWith("multipart/mixed")) {
    return true;
  }
  // fallback to standard filter function
  return compression.filter(req, res);
}
```

The shown compression filter function enables compression including
OData Batch (`$batch`) calls with content type `multipart/mixed`.

## Documentation

Instantiates a CDS OData V2 Adapter Proxy Express Router for a CDS-based OData V4 Server:

- **options:** CDS OData V2 Adapter Proxy options object
  - **base:** Base path under which the service is reachable. Default is `''`.
  - **path:** Path under which the proxy is reachable. Default is `'v2'`.
  - **model:** CDS service model (path(s) or CSN). Default is `'all'`.
  - **port:** Target port, which points to OData V4 backend port. Default is process.env.PORT or `4004`.
  - **target:** Target, which points to OData V4 backend host/port. Default is e.g. `'http://localhost:4004'`.
  - **targetPath:** Target path to which is redirected. Default is `''`.
  - **services:** Service mapping object from url path name to service name. Default is `{}`.
  - **mtxRemote:** CDS model is retrieved remotely via MTX endpoint for multitenant scenario. Default is `false`.
  - **mtxEndpoint:** Endpoint to retrieve MTX metadata when option 'mtxRemote' is active. Default is `'/mtx/v1'`.
  - **ieee754Compatible:** `Edm.Decimal` and `Edm.Int64` are serialized IEEE754 compatible. Default is `true`.
  - **disableNetworkLog:** Disable networking logging. Default is `true`.
  - **fileUploadSizeLimit:** File upload file size limit (in bytes). Default is `10485760` (10 MB).
  - **continueOnError:** Indicates to OData V4 backend to continue on error. Default is `false`.
  - **isoTime:** Use ISO 8601 format for type cds.Time (Edm.Time). Default is `false`.
  - **isoDate:** Use ISO 8601 format for type cds.Date (Edm.DateTime). Default is `false`.
  - **isoDateTime:** Use ISO 8601 format for type cds.DateTime (Edm.DateTimeOffset). Default is `false`.
  - **isoTimestamp:** Use ISO 8601 format for type cds.Timestamp (Edm.DateTimeOffset). Default is `false`.
  - **isoDateTimeOffset:** Use ISO 8601 format for type Edm.DateTimeOffset (cds.DateTime, cds.Timestamp). Default is `false`.
  - **bodyParserLimit:** Request and response body parser size limit. Default is '100mb'.
  - **returnComplexNested**: Function import return structure of complex type (non collection) is nested using function import name. Default is `true`.
  - **returnPrimitivePlain**: Function import return value of primitive type is rendered as plain JSON value. Default is `true`.
  - **messageTargetDefault**: Specifies the message target default, if target is undefined. Default is `/#TRANSIENT#`.
  - **caseInsensitive**: Transforms search functions e.g. substringof to case insensitive variant. Default is `false`.
  - **propagateMessageToDetails**: Propagates root error or message always to details section. Default is `false`.

All CDS OData V2 Adapter Proxy options can also be specified as part of CDS project-specific configuration
under section `cds.cov2ap` and accessed via `cds.env.cov2ap`.

Option `cds.env.odata.v2proxy.urlpath` is available to specify an OData V2 proxy url path
different from default `/v2` for CDS core.

### CDS Annotations

The following CDS OData V2 Adapter Proxy specific annotations are supported:

**Entity Level**:

- `@cov2ap.analytics: false`: Suppress analytics conversion for the annotated entity, if set to `false`.
- `@cov2ap.deltaResponse: 'timestamp'`: Delta response '\_\_delta' is added to response data of annotated entity with current timestamp information.
- `@cov2ap.isoTime`: Values of type cds.Time (Edm.Time) are represented in ISO 8601 format for annotated entity.
- `@cov2ap.isoDate`: Values of type cds.Date (Edm.DateTime) are represented in ISO 8601 format for annotated entity.
- `@cov2ap.isoDateTime`: Values of type cds.DateTime (Edm.DateTimeOffset) are represented in ISO 8601 format for annotated entity.
- `@cov2ap.isoTimestamp`: Values of type cds.Timestamp (Edm.DateTimeOffset) are represented in ISO 8601 format for annotated entity.
- `@cov2ap.isoDateTimeOffset`: Values of type Edm.DateTimeOffset (cds.DateTime, cds.Timestamp) are represented in ISO 8601 format for annotated entity.

**Entity Element Level**:

- `@Core.ContentDisposition.Filename: <element>`: Specifies entity element, representing the filename during file upload/download.
- `@Core.ContentDisposition.Type: <value>`: Controls the content disposition behavior in client/browser (`inline` or `attachment`). Default is `inline`.
- `@cov2ap.headerDecode`: Array of sequential decoding procedures ('uri', 'uriComponent', 'base64') used for media entity upload header.

### CDS Modelling

CDS project configuration `cds.odata.version` shall be set to `v4`, as OData proxy maps to OData V4.
CDS supports modelling features that are not compatible with OData V2 standard:

- **Structured Types:** Usage of `cds.odata.format: 'structured'` is not supported in combination with OData V2
- **Arrayed Types:** Usages of `array of` or `many` in entity element definitions lead to CDS compilation error: `Element must not be an "array of" for OData V2`

To provide an OData V2 service based on the CDS OData V2 Adapter Proxy, those CDS modelling features must not be used.
In general any CDS OData API flavor must not be used in combination with CDS OData V2 Adapter Proxy.

## Logging

Logging is controlled with environment variable `XS_APP_LOG_LEVEL`. Especially, proxy requests and proxy responses
including url and body adaptations can be traced using `XS_APP_LOG_LEVEL=debug`.
Details can be found at [@sap/logging](https://www.npmjs.com/package/@sap/logging).

### Logging Layers

Logging layers of CDS OData V2 Adapter Proxy start with `cov2ap`.

#### XS_APP_LOG_LEVEL = error

- `cov2ap/Authorization` : Error during authorization header parsing
- `cov2ap/MetadataRequest` : Error during metadata request processing
- `cov2ap/Request` : Error during request processing
- `cov2ap/Response` : Error during response processing
- `cov2ap/Batch` : Error during batch processing
- `cov2ap/AggregationKey` : Error during aggregation key determination
- `cov2ap/MediaStream` : Error during media stream processing
- `cov2ap/ContentDisposition` : Error during content disposition determination
- `cov2ap/FileUpload` : Error during file upload processing

#### XS_APP_LOG_LEVEL = warning

- `cov2ap/Service` : Service definition not found for request path
- `cov2ap/Context` : Definition not found in CDS meta model

#### XS_APP_LOG_LEVEL = debug

- `cov2ap/Request`: Log of OData V2 client request (url, body, headers)
- `cov2ap/ProxyRequest`: Log of OData V4 proxy request (url, body, headers)
- `cov2ap/ProxyResponse`: Log of OData V4 proxy response (status code/message, body, headers)
- `cov2ap/Response`: Log of OData V2 client response (status code/message, body, headers)

## Features

- GET, POST, PUT / MERGE / PATCH, DELETE
- Batch support
- Actions, Functions
- Analytical Annotations
- Deep Expands/Selects
- JSON format
- Deep Structures
- Data Type Mapping
- IEEE754Compatible
- Messages / Error Handling
- Location Header
- $inlinecount / $count / \$value
- Entity with Parameters
- File Upload (binary, multipart/form-data)
- Stream Support (Octet and Url)
- Content Disposition
- Content-ID
- Multi-Tenancy
- Extensibility
- Draft Support
- Search Support
- Localization
- Temporal Data
- Tracing Support
- Logging Correlation
- ETag Support (Concurrency Control)
- Next Links (skiptoken)
- Delta Responses (deltatoken)
- Continue-On-Error
- X-HTTP-Method

## OData V2/V4 Delta

[What’s New in OData Version 4.0](http://docs.oasis-open.org/odata/new-in-odata/v4.0/cn01/new-in-odata-v4.0-cn01.html)

## License

This package is provided under the terms of the [SAP Developer License Agreement](https://tools.hana.ondemand.com/developer-license-3.1.txt).
