# cds-odata-v2-adapter-proxy

OData v2 Adapter Proxy for CDS OData v4 Services

## Build Status
[![Build Status](https://gkecdxodata.jaas-gcp.cloud.sap.corp/buildStatus/icon?job=cds-community%2Fcds-odata-v2-adapter-proxy%2Fmaster)](https://gkecdxodata.jaas-gcp.cloud.sap.corp/job/cds-community/job/cds-odata-v2-adapter-proxy/job/master/)

## Getting Started

- Install: `npm install`
- Unit Tests: `npm test`
- Test Server: `npm start`
    - Service: `http://localhost:4004/v2/main`
    - Metadata: `http://localhost:4004/v2/main/$metadata`
    - Data: `http://localhost:4004/v2/main/Header?$expand=Items`

## Usage

```
const express = require("express");
const odatav2proxy = require("@sap/cds-odata-v2-adapter-proxy");

const app = express();
app.use(odatav2proxy({ path: "v2", model: "srv/index", port: 4004 }));
...
```

## Documentation

Instantiates an CDS OData v2 Adapter Proxy Express Router for a CDS based OData v4 Server
- **options:** CDS OData v2 Adapter Proxy options
- **[options.base]** Base path, under which the service is reachable. Default is ''.
- **[options.path]:** Path, under which the proxy is reachable. Default is 'v2'.
- **[options.model]:** CDS service model path. Default is 'all'.
- **[options.port]:** Target port, which points to OData v4 backend port. Default is '4004'.
- **[options.target]:** Target, which points to OData v4 backend host/port. Default is 'http://localhost:4004'.
- **[options.services]:** Service mapping, from url path name to service name. If omitted CDS defaults apply.
- **[options.standalone]** Indication, that OData v2 Adapter proxy is a standalone process. Default is 'false'.
- **[options.mtxEndpoint]** Endpoint to retrieve MTX metadata. Default is '/mtx/v1'
 
## Features

- GET, POST, PUT/PATCH, DELETE
- Batch support
- Actions, Functions
- Analytical Annotations
- Deep Expands/Selects
- JSON format
- Deep Structures
- Data Type Mapping (incl. Date Time)
- IEEE754Compatible
- Messages/Error Handling
- Location Header
- $inlinecount / $count / $value
- Entity with Parameters
- Octet Stream, Content Disposition
- Multitenancy, Extensibility (proxy in same process only)
- Content-ID
- Tracing

## OData v2/v4 Delta
 
 http://docs.oasis-open.org/odata/new-in-odata/v4.0/cn01/new-in-odata-v4.0-cn01.html

**Open:**
- $links -> $ref
- KEY(...) -> $root
- years, months, days, minutes, seconds
- Function Parameters as Query Options
