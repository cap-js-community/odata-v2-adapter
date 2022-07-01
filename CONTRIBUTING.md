# Contribution Guide

### Do you want to contribute to CDS OData V2 Adapter Proxy?

Contributions via **pull requests** are welcome.

The development team of CDS OData V2 Adapter Proxy is looking forward to any contribution.
The following contribution guide gives you a high level overview of the project and should help to jump start your contribution.

- Source code is located at file `src/index.js`
- Typings are defined in `src/index.d.ts`
- Unit Tests are located in folder `test`
- HANA Integration Tests are located in folder `test-integration`: `npm test:integration`

### How to run the project?

- `npm test`: Execute test suite (unit tests + integration tests)
  - `npm run test:unit`: Execute unit tests only
  - `npm run test:integration`: Execute integration tests only
- `npm start`: Start test server incl. example apps (SQLite)
  - `npm run start:hana` Start test server incl. example apps (HANA)

### Did find an issue?

Open a new issue [here](https://github.wdf.sap.corp/cds-community/cds-odata-v2-adapter-proxy/issues/new).
