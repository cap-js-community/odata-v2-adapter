# @cap-js-community/odata-v2-adapter (cov2ap)

[![npm version](https://img.shields.io/npm/v/@cap-js-community/odata-v2-adapter)](https://www.npmjs.com/package/@cap-js-community/odata-v2-adapter)
[![monthly downloads](https://img.shields.io/npm/dm/@cap-js-community/odata-v2-adapter)](https://www.npmjs.com/package/@cap-js-community/odata-v2-adapter)
[![REUSE status](https://api.reuse.software/badge/github.com/cap-js-community/odata-v2-adapter)](https://api.reuse.software/info/github.com/cap-js-community/odata-v2-adapter)
[![Main CI](https://github.com/cap-js-community/odata-v2-adapter/actions/workflows/main-ci.yml/badge.svg)](https://github.com/cap-js-community/odata-v2-adapter/commits/main)

### [OData V2 Adapter for CDS](https://www.npmjs.com/package/@cap-js-community/odata-v2-adapter)

> Exposes a full-fledged OData V2 service, converting OData V2 requests to CDS OData V4 service calls and responses back.
> Runs in context of the [SAP Cloud Application Programming Model (CAP)](https://cap.cloud.sap/docs/)
> using CDS Node.js module [@sap/cds](https://www.npmjs.com/package/@sap/cds) or CDS Java modules
> [com.sap.cds](https://mvnrepository.com/artifact/com.sap.cds).

## Table of Contents

- [Getting Started](#getting-started)
- [Options](#options)
- [Documentation](#documentation)
  - [Singleton](#singleton)
  - [Before Middlewares](#before-middlewares)
  - [Custom Server](#custom-server)
  - [Logging](#logging)
  - [CDS Annotations](#cds-annotations)
  - [CDS Modeling Restrictions](#cds-modeling-restrictions)
  - [Cloud Foundry Deployment](#cloud-foundry-deployment)
  - [Multitenancy, Feature Toggles and Extensibility (MTX)](#multitenancy-feature-toggles-and-extensibility-mtx)
  - [Build Task](#build-task)
  - [Unit-Tests](#unit-tests)
  - [SAP Fiori Elements V2](#sap-fiori-elements-v2)
  - [Compression Support](#compression-support)
- [Contributions](#contributions)
- [Features](#features)
- [OData V2/V4 Delta](#odata-v2v4-delta)
- [Support, Feedback, Contributing](#support-feedback-contributing)
- [Code of Conduct](#code-of-conduct)
- [Licensing](#licensing)

## Getting Started

- Run `npm add @cap-js-community/odata-v2-adapter` in `@sap/cds` project
- Execute `cds-serve` to start server
  - OData V2 service is available at http://localhost:4004/odata/v2/<service-path>
  - OData V4 service is available at http://localhost:4004/odata/v4/<service-path>

## Options

The OData V2 adapter for CDS instantiates an Express router. The following options are available:

- **plugin**: OData V2 adapter is instantiated as part of CDS plugin. Default is `true`.
- **build**: In case of plugin scenario, a build step is registered to prepare the OData V2 metadata. Default is `true`.
- **base**: Base path under which the service is reachable. Default is `''`.
- **path**: Path under which the service is reachable. Default is `'odata/v2'`. Default path is `'v2'` for CDS <7 or `middlewares` deactivated.
- **model**: CDS service model (path(s) or CSN). Default is `'all'`.
- **port**: Target port which points to OData V4 backend port. Default is process.env.PORT or `4004`.
- **target**: Target which points to OData V4 backend host:port. Use `'auto'` to infer the target from server url after listening. Default is e.g. `'auto'`.
- **targetPath**: Target path to which is redirected. Default is `'odata/v4'`. Default path is `''` for CDS <7 or `middlewares` deactivated.
- **services**: Service mapping object from url path name to service name. Default is `{}`.
- **mtxRemote**: CDS model is retrieved remotely via MTX endpoint for multitenant scenario (classic MTX only). Default is `false`.
- **mtxEndpoint**: Endpoint to retrieve MTX metadata when option 'mtxRemote' is active (classic MTX only). Default is `'/mtx/v1'`.
- **ieee754Compatible**: Edm.Decimal and Edm.Int64 are serialized IEEE754 compatible. Default is `true`.
- **fileUploadSizeLimit**: File upload file size limit (in bytes) for multipart/form-data requests. Default is `10485760` (10 MB).
- **continueOnError**: Indicates to OData V4 backend to continue on error. Default is `false`.
- **isoTime**: Use ISO 8601 format for type cds.Time (Edm.Time). Default is `false`.
- **isoDate**: Use ISO 8601 format for type cds.Date (Edm.DateTime). Default is `false`.
- **isoDateTime**: Use ISO 8601 format for type cds.DateTime (Edm.DateTimeOffset). Default is `false`.
- **isoTimestamp**: Use ISO 8601 format for type cds.Timestamp (Edm.DateTimeOffset). Default is `false`.
- **isoDateTimeOffset**: Use ISO 8601 format for type Edm.DateTimeOffset (cds.DateTime, cds.Timestamp). Default is `false`.
- **bodyParserLimit**: Request and response body parser size limit. Default is `'100mb'`.
- **returnCollectionNested**: Collection of entity type is returned nested into a results section. Default is `true`.
- **returnComplexNested**: Function import return structure of complex type (non collection) is nested using function import name. Default is `true`.
- **returnPrimitiveNested**: Function import return structure of primitive type (non collection) is nested using function import name. Default is `true`.
- **returnPrimitivePlain**: Function import return value of primitive type is rendered as plain JSON value. Default is `true`.
- **messageTargetDefault**: Specifies the message target default, if target is undefined. Default is `'/#TRANSIENT#'`.
- **caseInsensitive**: Transforms search functions i.e. substringof, startswith, endswith to case-insensitive variant. Default is `false`.
- **propagateMessageToDetails**: Propagates root error or message always to details section. Default is `false`.
- **contentDisposition**: Default content disposition for media streams (inline, attachment), if not available or calculated. Default is `'attachment'`.
- **calcContentDisposition**: Calculate content disposition for media streams even if already available. Default is `false`.
- **quoteSearch**: Specifies if search expression is quoted automatically. Default is `true`.
- **fixDraftRequests**: Specifies if unsupported draft requests are converted to a working version. Default is `false`.
- **changesetDeviationLogLevel**: Log level of batch changeset content-id deviation logs (none, debug, info, warn, error). Default is `'info'`.
- **defaultFormat**: Specifies the default entity response format (json, atom). Default is `'json'`.
- **processForwardedHeaders**: Specifies if `x-forwarded` headers are processed. Default is `true`.
- **cacheDefinitions**: Specifies if the definition elements are cached. Default is `true`.
- **cacheMetadata**: Specifies the caching and provisioning strategy of metadata (e.g. edmx) (memory, disk, stream). Default is `'memory'`.
- **registerOnListening**: Routes are registered on CDS `listening` event instead of registering routes immediately. Default is `true`.

> All OData V2 adapter for CDS options can also be specified as part of CDS project-specific configuration
> under section `cds.cov2ap` and accessed during runtime via `cds.env.cov2ap`.

> Options can also be passed as command line environment variable, by converting the camel-cased option name to snake-case.
> Underscores (`_`) need then to be escaped as double underscore (`__`) when provided via command line environment variable.
>
> Example:
>
> - path => CDS_COV2AP_PATH=odatav2
> - quoteSearch => quote_search => CDS_COV2AP_QUOTE\_\_SEARCH=false

## Documentation

### Singleton

CDS OData V2 adapter is instantiated via CDS plugin as singleton, which is exposed at:

```js
const cds = require("@sap/cds");
cds.cov2ap;
```

The singleton can also be instantiated manually and accessed in custom server via:

```js
const cov2ap = require("@cap-js-community/odata-v2-adapter");
cov2ap.singleton();
```

### Before Middlewares

Before middleware routes can be registered on the OData V2 adapter for CDS singleton, to be executed before the main route processing.
The before middleware routes can be registered as single function or as array of route functions.

Single before route can be registered as follows:

```js
const cds = require("@sap/cds");

cds.on("bootstrap", (app) => {
  cds.cov2ap.before = (req, res, next) => {
    // custom route processing
    next();
  };
});
```

Multiple before routes can be registered as follows:

```js
const cds = require("@sap/cds");

cds.on("bootstrap", (app) => {
  cds.cov2ap.before = [
    (req, res, next) => {
      // custom route processing
      next();
    },
    (req, res, next) => {
      // custom route processing
      next();
    },
  ];
});
```

### Custom Server

- Enhance or create `./srv/server.js`:
  ```js
  const cds = require("@sap/cds");
  const cov2ap = require("@cap-js-community/odata-v2-adapter");
  cds.on("bootstrap", (app) => app.use(cov2ap()));
  module.exports = cds.server;
  ```

### Logging

Logging is based on [cds.log](https://cap.cloud.sap/docs/node.js/cds-log), therefore CDS logging configurations apply.

#### Logging Modules

| Component                | Module Name(s) |
| ------------------------ | -------------- |
| OData V2 adapter for CDS | cov2ap         |

#### Kibana Logging

In order to enable Kibana friendly logging for `cds.log`
feature toggle `cds.features.kibana_formatter: true` needs to be set.

#### Debug Mode

Debug mode can be activated to log requests and responses processed (V2) and initiated (V4)
by OData V2 adapter for CDS. The following information can be retrieved for analysis:

- **Request** url, headers, body
- **Response**: status code/message, headers, body

Debug log level can be activated

- via command line environment variable: `CDS_LOG_LEVELS_COV2AP=debug`
- via `cds.env` in code: `cds.env.log.levels.cov2ap = "debug"`

Details on how to set CDS environment can be found at [cds.env](https://cap.cloud.sap/docs/node.js/cds-env).

#### Log Levels

Logging can be configured to respect the following log levels:

- **error**: Error logs are written (includes **warn**)
- **warn**: Warning logs are written (includes **info**)
- **info**: Info logs are written (includes **debug**)
- **debug**: Debug logs are written
- **trace**: Same as **debug**
- **silent**: No logs are written

#### Logging Components

##### cds.log.levels.cov2ap: "error"

- `[cov2ap] - Proxy:` Proxy processing error
- `[cov2ap] - Cache:` Metadata cache error
- `[cov2ap] - Authorization:` Authorization header parsing error
- `[cov2ap] - MetadataRequest:` Metadata request processing error
- `[cov2ap] - Request:` Request processing error
- `[cov2ap] - Response:` Response processing error
- `[cov2ap] - Batch:` Batch processing error
- `[cov2ap] - AggregationKey:` Aggregation key error
- `[cov2ap] - MediaStream:` Media stream processing error
- `[cov2ap] - FileUpload:` File upload processing error

##### cds.log.levels.cov2ap: "warn"

- `[cov2ap] - Service:` Invalid service definition (name, path)
- `[cov2ap] - Context:` Invalid (sub-)definition (name, path)
- `[cov2ap] - ContentDisposition:` Content disposition warning

##### cds.log.levels.cov2ap: "info"

- `[cov2ap] - Batch:` Changeset order deviation (req, res)

##### cds.log.levels.cov2ap: "debug"

- `[cov2ap] - Request:` Log OData V2 client request (url, headers, body)
- `[cov2ap] - ProxyRequest:` Log OData V4 proxy request (url, headers, body)
- `[cov2ap] - ProxyResponse:` Log OData V4 proxy response (status code/message, headers, body)
- `[cov2ap] - Response:` Log OData V2 client response (status code/message, headers, body)

#### http-proxy-middleware

- `[cov2ap] - [HPM]`: Proxy middleware processing logs

### CDS Annotations

The following OData V2 adapter for CDS specific annotations are supported:

**Service Level**:

- `@protocol: [{ kind: 'odata-v2', path: '<path>' }]`: Specifies an additional custom relative OData V2 protocol service path (prepending OData V2 protocol prefix)
- `@protocol: [{ kind: 'odata-v2', path: '/<path>' }]`: Specifies an additional custom absolute OData V2 protocol service path (ignoring OData V2 protocol prefix)
- `@cov2ap.ignore`: Exclude service from OData V2 adapter conversion (service is not exposed as OData V2 service)

**Entity Level**:

- `@cov2ap.analytics: false`: Suppress analytics conversion for the annotated entity, if set to `false`.
- `@cov2ap.analytics.skipForKey`: Suppress analytical conversion for the annotated entity, if all dimension key elements are requested
- `@cov2ap.deltaResponse: 'timestamp'`: Delta response '\_\_delta' is added to response data of annotated entity with current timestamp information.
- `@cov2ap.isoTime`: Values of type cds.Time (Edm.Time) are represented in ISO 8601 format for annotated entity.
- `@cov2ap.isoDate`: Values of type cds.Date (Edm.DateTime) are represented in ISO 8601 format for annotated entity.
- `@cov2ap.isoDateTime`: Values of type cds.DateTime (Edm.DateTimeOffset) are represented in ISO 8601 format for annotated entity.
- `@cov2ap.isoTimestamp`: Values of type cds.Timestamp (Edm.DateTimeOffset) are represented in ISO 8601 format for annotated entity.
- `@cov2ap.isoDateTimeOffset`: Values of type Edm.DateTimeOffset (cds.DateTime, cds.Timestamp) are represented in ISO 8601 format for annotated entity.

**Entity Element Level**:

- `@Core.ContentDisposition.Filename: <element>`: Specifies entity element, representing the filename during file upload/download.
- `@Core.ContentDisposition.Type: '<value>'`: Controls the content disposition behavior in client/browser (`inline` or `attachment`).
- `@cov2ap.headerDecode: [...]`: Array of sequential decoding procedures ('uri', 'uriComponent', 'base64') used for media entity upload header.

### CDS Modeling Restrictions

CDS project configuration `cds.odata.version` shall be set to `v4`, as OData V2 maps to OData V4.
CDS supports modelling features that are not compatible with OData V2 standard:

- **Singletons**: Usage of annotation `@odata.singleton` is not supported in combination with OData V2
- **Structured Types**: Usage of `cds.odata.structs: true` is not supported in combination with OData V2
- **Map Type**: Usage of data type `cds.Map` is not supported in combination with OData V2
- **Arrayed Types**: Usages of `array of` or `many` in entity element definitions lead to CDS compilation error: `Element must not be an "array of" for OData V2`
- **Managed Compositions**: The usage of managed composition (currently) produces Format Exception in Fiori Elements V2 for Date/Time data types

To provide an OData V2 service based on the OData V2 adapter for CDS, those CDS modelling features must not be used.
In general any CDS OData API flavor must not be used in combination with OData V2 adapter for CDS.

Per default, those modelling incompatibilities are reported as `Warning` and will not stop the compilation.
The resulting EDMX V2 may be invalid and not processable by an OData V2 client. To prevent this situation and fail
early to detect modelling incompatibilities, the severity for respective codes can be increased to `Error`,
by setting the following environment variables:

```json
{
  "cdsc": {
    "severities": {
      "odata-spec-violation-array": "Error",
      "odata-spec-violation-param": "Error",
      "odata-spec-violation-returns": "Error",
      "odata-spec-violation-assoc": "Error",
      "odata-spec-violation-constraints": "Error"
    }
  }
}
```

### Cloud Foundry Deployment

When deploying the OData V2 adapter for CDS to Cloud Foundry, make sure that it has access to the whole CDS model.
Especially, it’s the case, that normally the Node.js server is only based on folder `srv` and folder `db` is then missing on Cloud Foundry.

To come around this situation, trigger a `cds build` during development time, that generates a `csn.json` at location `gen/srv/srv/csn.json`.
Point your Cloud Foundry deployment of the OData V2 adapter for CDS to the folder `gen/srv` (using manifest.json or MTA), so that
the CDS models can be found via file `srv/csn.json`, during runtime execution on Cloud Foundry.

Make sure, that all i18n property files reside next to the `csn.json` in a `i18n` or `_i18n` folder, to be detected by localization.

### Multitenancy, Feature Toggles and Extensibility (MTX)

OData V2 adapter for CDS supports multitenant scenarios. Basic extensibility is already supported in combination with the
[CDS MTX](https://www.npmjs.com/package/@sap/cds-mtx) module. More advanced extensibility scenarios and feature toggles
are supported in combination with the [CDS Streamlined MTX services](https://www.npmjs.com/package/@sap/cds-mtxs).

In order to provide the feature toggle vector to be used to build-up the corresponding `CSN` and `EDMX` metadata documents,
the Express request object `req` needs to enhanced by feature definitions.
To add support for a specific feature toggles management you can add a simple Express middleware as follows, for example, in your `server.js`:

```js
const cds = require("@sap/cds");
cds.on(
  "bootstrap",
  (app) =>
    (cds.cov2ap.before = (req, res, next) => {
      req.features = req.features || ["advanced"];
      next();
    }),
);
```

### Build Task

CDS OData V2 adapter includes an CDS build task, that allows to prepare the OData V2 EDMX files for MTX sidecar app.
The build task is automatically active, in case project is running in multi-tenant context including MTX sidecar.  
It can be deactivated using option `cds.cov2ap.build: false`.

### Unit-Tests

This repository comes with a suite of unit-tests covering the complete proxy implementation.
The tests can be executed as follows:

- SQLite based:
  - `npm run test:unit` ([source](test))
- HANA based:
  - Place HANA credentials at `test-hana/_env/db/default-services.json` in format:
    ```json
    {
      "hana": [
        {
          "credentials": {}
        }
      ]
    }
    ```
  - Deploy HANA (root dir): `npm run deploy:hana`
  - Run tests (root dir): `npm run test:hana` ([source](test-hana))
- Postgres based:
  - Start Postgres on port `5432`
  - Assure default configuration is available (user, password, database) is set to `postgres`
  - Deploy HANA (root dir): `npm run deploy:postgres`
  - Run tests (root dir): `npm run test:postgres` ([source](test-postgres))
- CI Tests (SQLite + HANA):
  - `npm test`

All tests are executed as part of the GitHub Actions Continuous Integration (CI) pipeline.

### SAP Fiori Elements V2

The OData V2 service provided by the OData V2 adapter for CDS can be used to serve an SAP Fiori Elements V2 UI.

SAP Fiori Elements V2 examples:

- SQLite based:
  - **Analytics**: Analytical List Page app ([source](test/_env/app/analytics))
  - **Basic Edit**: Basic editing app ([source](test/_env/app/basic))
  - **Draft Edit**: Draft supported editing app ([source](test/_env/app/draft))
  - **Hierarchy**: Hierarchical display of data in tree table ([source](test/_env/app/hierarchy))
  - **Overview**: Overview Page app ([source](test/_env/app/overview))
  - **XML**: Basic app (Atom format) ([source](test/_env/app/xml))
- HANA based:
  - **Parameters**: Parameterized entity app ([source](test-hana/_env/app/parameters))
- Postgres based:
  - **Basic Edit**: Basic editing app ([source](test-postgres/_env/app/basic))

Examples can be tested as follows:

- Start server:
  - SQLite based: `npm start`
  - HANA based: `npm run start:hana`
  - Postgres based: `npm run start:postgres`
- Open Fiori Launchpad: http://localhost:4004/flp.html

### Compression Support

Response compressions can be enabled, by registering the `compression` Node.js
module in Express app at bootstrap time, e.g. in `srv/server.js`:

```js
const cds = require("@sap/cds");
const compression = require("compression");

cds.on("bootstrap", (app) => {
  cds.cov2ap.before = [compression({ filter: shouldCompress })];
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

#### Approuter Compression

`@sap/approuter` now support out-of-the-box compression for OData $batch calls with `multipart/mixed`.
It's disabled by default, but can be enabled using option [compressResponseMixedTypeContent](https://www.npmjs.com/package/@sap/approuter#compression-property).

## Custom Bootstrap

### CAP Node.js Custom

- Run `npm install @cap-js-community/odata-v2-adapter -s` in `@sap/cds` project
- Create new file `./srv/index.js`:

```js
const express = require("express");
const cds = require("@sap/cds");
const cov2ap = require("@cap-js-community/odata-v2-adapter");

const host = "0.0.0.0";
const port = process.env.PORT || 4004;

(async () => {
  const app = express();

  // OData V2
  app.use(cov2ap());

  // OData V4
  await cds.connect.to("db");
  await cds.serve("all").in(app);

  const server = app.listen(port, host, () => console.info(`app is listing at ${host}:${port}`));
  server.on("error", (error) => console.error(error.stack));
})();
```

- Run `node srv/index` from the project root to start the server:
  - OData V2 service will be available at http://localhost:4004/odata/v2/<service-path>
  - OData V4 service will be available at http://localhost:4004/odata/v4/<service-path>

Note that `@sap/cds` is a peer dependency and needs to be available as module as well.

### CAP Java Custom

> For CAP Java projects prefer the Native CDS OData V2 Adapter ([com.sap.cds/cds-adapter-odata-v2](https://mvnrepository.com/artifact/com.sap.cds/cds-adapter-odata-v2)).

- Run `npm install @cap-js-community/odata-v2-adapter -s` in `@sap/cds` project
- Provide CDS models (`db`, `srv`, `app`) or compile a generated CSN (see details below)
- Create new file `./srv/index.js`:

```js
const express = require("express");
const cov2ap = require("@cap-js-community/odata-v2-adapter");

const host = "0.0.0.0";
const port = process.env.PORT || 4004;

(async () => {
  const app = express();

  // OData V2
  app.use(
    cov2ap({
      target: "<odata-v4-backend-url>", // locally e.g. http://localhost:8080
      services: {
        "<odata-v4-service-path>": "<qualified.ServiceName>",
      },
      registerOnListening: false,
    }),
  );

  const server = app.listen(port, host, () => console.info(`app is listing at ${host}:${port}`));
  server.on("error", (error) => console.error(error.stack));
})();
```

- Run `node srv/index` from the project root to start the server:
  - OData V2 service will be available at http://localhost:4004/odata/v2/<odata-v4-service-path>
  - OData V4 service shall be available e.g. at http://localhost:8080/<odata-v4-service-path>

#### Additional Considerations

- A deployed version of OData V2 adapter for CDS shall have option `target` set to the deployed OData V4 backend URL.
  This can be retrieved from the Cloud Foundry environment using `process.env`, for example,
  from the `destinations` environment variable. Locally e.g. http://localhost:8080 can be used.
- In option `services`, every OData V4 service URL path needs to mapped to
  the corresponding fully qualified CDS service name, e.g. `"/odata/v4/MainService/": "test.MainService"`,
  to establish the back-link connection between OData URL and its CDS service.
- Make sure, that your CDS models are also available in the project.
  Those reside either in `db`, `srv`, `add` folders, or a compiled (untransformed) `srv.json` is provided.
  This can be generated by using the following command: `cds srv -s all -o .`
- Alternatively, a `cds build` can be triggered as described in section "Cloud Foundry Deployment".
- If not detected automatically, the model path can be set with option `model` (especially if `csn.json`/`srv.json` option is used).
- Make sure, that all i18n property files reside next to the `csn.json` in a `i18n` or `_i18n` folder, to be detected by localization.
- In a multitenant scenario in combination with a standalone app, the CDS model can be retrieved remotely via MTX endpoint (`mtxEndpoint`) by setting option `mtxRemote: true`.
- Option `mtxEndpoint` can be specified as absolute url (starting with `http://` or `https://`), to be able to address MTX Sidecar
  possibly available under a target different from OData v4 backend URL. If not specified absolutely, `target` is prepended to `mtxEndpoint`.

## Contributions

- Unit Tests: `npm test`
- Test Server: `npm start`
  - Service: `http://localhost:4004/odata/v2/main`
  - Metadata: `http://localhost:4004/odata/v2/main/$metadata`
  - Data: `http://localhost:4004/odata/v2/main/Header?$expand=Items`

For more details see [CONTRIBUTION](CONTRIBUTING.md) guide.

## Features

- GET, POST, PUT / MERGE / PATCH, DELETE
- Batch support
- Actions, Functions
- Analytical Annotations
- Deep Expands/Selects
- JSON, Atom (XML) format
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
- Multitenancy (mtx, mtxs)
- Feature Toggles
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

## Support, Feedback, Contributing

This project is open to feature requests/suggestions, bug reports etc. via [GitHub issues](https://github.com/cap-js-community/odata-v2-adapter/issues). Contribution and feedback are encouraged and always welcome. For more information about how to contribute, the project structure, as well as additional contribution information, see our [Contribution Guidelines](CONTRIBUTING.md).

## Code of Conduct

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone. By participating in this project, you agree to abide by its [Code of Conduct](CODE_OF_CONDUCT.md) at all times.

## Licensing

Copyright 2024 SAP SE or an SAP affiliate company and <your-project> contributors. Please see our [LICENSE](LICENSE) for copyright and license information. Detailed information including third-party components and their licensing/copyright information is available [via the REUSE tool](https://api.reuse.software/info/github.com/cap-js-community/odata-v2-adapter).
