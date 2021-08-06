"use strict";

// OData V2/V4 Delta: http://docs.oasis-open.org/odata/new-in-odata/v4.0/cn01/new-in-odata-v4.0-cn01.html

const URL = require("url");
const express = require("express");
const expressFileUpload = require("express-fileupload");
const fetch = require("node-fetch");
const cds = require("@sap/cds");
const logging = require("@sap/logging");
const { promisify } = require("util");
const { createProxyMiddleware } = require("http-proxy-middleware");

const SeverityMap = {
  1: "success",
  2: "info",
  3: "warning",
  4: "error",
};

// NOTE: we want to support HANA's SYSUUID, which does not conform to real UUID formats
const UUIDLikeRegex = /guid'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'/gi;
// https://www.w3.org/TR/xmlschema11-2/#nt-duDTFrag
const DurationRegex =
  /^P(?:(\d)Y)?(?:(\d{1,2})M)?(?:(\d{1,2})D)?T(?:(\d{1,2})H)?(?:(\d{2})M)?(?:(\d{2}(?:\.\d+)?)S)?$/i;

const DataTypeMap = {
  "cds.UUID": { v2: `guid'$1'`, v4: UUIDLikeRegex },
  "cds.Binary": { v2: `binary'$1'`, v4: /X'(?:[0-9a-f][0-9a-f])+?'/gi },
  "cds.LargeBinary": { v2: `binary'$1'`, v4: /X'(?:[0-9a-f][0-9a-f])+?'/gi },
  "cds.Time": { v2: `time'$1'`, v4: /time'(.+?)'/gi },
  "cds.Date": { v2: `datetime'$1'`, v4: /datetime'(.+?)'/gi },
  "cds.DateTime": { v2: `datetimeoffset'$1'`, v4: /datetimeoffset'(.+?)'/gi },
  "cds.Timestamp": { v2: `datetimeoffset'$1'`, v4: /datetimeoffset'(.+?)'/gi },
  "cds.Double": { v2: `$1d`, v4: /([-]?[0-9]+?\.?[0-9]*(?:E[+-]?[0-9]+?)?)d/gi },
  "cds.Decimal": { v2: `$1m`, v4: /([-]?[0-9]+?\.?[0-9]*)m/gi },
  "cds.DecimalFloat": { v2: `$1f`, v4: /([-]?[0-9]+?\.?[0-9]*)f/gi },
  "cds.Integer64": { v2: `$1L`, v4: /([-]?[0-9]+?)L/gi },
  "cds.String": { v2: `'$1'`, v4: /(.*)/gi },
};

const DataTypeOData = {
  Binary: "cds.Binary",
  Boolean: "cds.Boolean",
  Byte: "cds.Binary",
  DateTime: "cds.DateTime",
  DateTimeOffset: "cds.Timestamp",
  Decimal: "cds.Decimal",
  Double: "cds.Double",
  Single: "cds.Double",
  Guid: "cds.UUID",
  Int16: "cds.Integer",
  Int32: "cds.Integer",
  Int64: "cds.Integer64",
  SByte: "cds.Integer",
  String: "cds.String",
  Date: "cds.Date",
  Time: "cds.TimeOfDay",
};

const AggregationMap = {
  SUM: "sum",
  MIN: "min",
  MAX: "max",
  AVG: "average",
  COUNT: "countdistinct",
  COUNT_DISTINCT: "countdistinct",
};

const DefaultAggregation = AggregationMap.SUM;

const FilterFunctions = {
  "substringof($,$)": "contains($2,$1)",
  "gettotaloffsetminutes($)": "totaloffsetminutes($1)",
};

const ProcessingDirection = {
  Request: "req",
  Response: "res",
};

const DefaultHost = "localhost";
const DefaultPort = 4004;
const DefaultTenant = "00000000-0000-0000-0000-000000000000";
const AggregationPrefix = "__AGGREGATION__";
const IEEE754Compatible = "IEEE754Compatible=true";

function convertToNodeHeaders(webHeaders) {
  return Array.from(webHeaders.entries()).reduce((result, [key, value]) => {
    result[key] = value;
    return result;
  }, {});
}

/**
 * Instantiates a CDS OData V2 Adapter Proxy Express Router for a CDS-based OData V4 Server:
 * @param {object} options CDS OData V2 Adapter Proxy options object
 * @param {string} options.base Base path under which the service is reachable. Default is ''.
 * @param {string} options.path Path under which the proxy is reachable. Default is 'v2'.
 * @param {string|string[]|object} options.model CDS service model (path(s) or CSN). Default is 'all'.
 * @param {number} options.port Target port, which points to OData V4 backend port. Default is process.env.PORT or 4004.
 * @param {string} options.target Target, which points to OData V4 backend host/port. Default is e.g. 'http://localhost:4004'.
 * @param {string} options.targetPath Target path to which is redirected. Default is ''.
 * @param {object} options.services Service mapping object from url path name to service name. Default is {}.
 * @param {boolean} options.mtxRemote CDS model is retrieved remotely via MTX endpoint for multitenant scenario. Default is false.
 * @param {string} options.mtxEndpoint Endpoint to retrieve MTX metadata when option 'mtxRemote' is active. Default is '/mtx/v1'.
 * @param {boolean} options.ieee754Compatible `Edm.Decimal` and `Edm.Int64` are serialized IEEE754 compatible. Default is true.
 * @param {boolean} options.disableNetworkLog Disable networking logging. Default is true.
 * @param {number} options.fileUploadSizeLimit File upload file size limit (in bytes). Default is 10485760 (10 MB).
 * @param {boolean} options.continueOnError Indicates to OData V4 backend to continue on error. Default is false.
 * @param {boolean} options.isoTime Use ISO 8601 format for type cds.Time (Edm.Time). Default is false.
 * @param {boolean} options.isoDate Use ISO 8601 format for type cds.Date (Edm.DateTime). Default is false.
 * @param {boolean} options.isoDateTime Use ISO 8601 format for type cds.DateTime (Edm.DateTimeOffset). Default is false.
 * @param {boolean} options.isoTimestamp Use ISO 8601 format for type cds.Timestamp (Edm.DateTimeOffset). Default is false.
 * @param {boolean} options.isoDateTimeOffset Use ISO 8601 format for type Edm.DateTimeOffset (cds.DateTime, cds.Timestamp). Default is false.
 * @param {string} options.bodyParserLimit Request and response body size limit. Default is '100mb'.
 * @param {boolean} options.returnComplexNested Function import return structure of complex type (non collection) is nested using function import name. Default is `true`.
 * @param {boolean} options.returnPrimitivePlain Function import return value of primitive type is rendered as plain JSON value. Default is `true`.
 * @param {string} options.messageTargetDefault Specifies the message target default, if target is undefined. Default is `/#TRANSIENT#`.
 * @returns {Router} CDS OData V2 Adapter Proxy Express Router
 */
function cov2ap(options = {}) {
  const optionWithFallback = (name, fallback) => {
    if (options && Object.prototype.hasOwnProperty.call(options, name)) {
      return options[name];
    }
    if (cds.env.cov2ap && Object.prototype.hasOwnProperty.call(cds.env.cov2ap, name)) {
      return cds.env.cov2ap[name];
    }
    return fallback;
  };

  const proxyCache = {};
  const appContext = logging.createAppContext();
  const router = express.Router();
  const base = optionWithFallback("base", "");
  const path = optionWithFallback("path", "v2");
  const sourcePath = `${base ? "/" + base : ""}/${path}`;
  const targetPath = optionWithFallback("targetPath", "");
  const rewritePath = `${base ? "/" + base : ""}${targetPath ? "/" : ""}${targetPath}`;
  const pathRewrite = { [`^${sourcePath}`]: rewritePath };
  const port = optionWithFallback("port", process.env.PORT || DefaultPort);
  const target = optionWithFallback("target", `http://${DefaultHost}:${port}`);
  const services = optionWithFallback("services", {});
  const mtxRemote = optionWithFallback("mtxRemote", false);
  const mtxEndpoint = optionWithFallback("mtxEndpoint", "/mtx/v1");
  const ieee754Compatible = optionWithFallback("ieee754Compatible", true);
  const disableNetworkLog = optionWithFallback("disableNetworkLog", true);
  const fileUploadSizeLimit = optionWithFallback("fileUploadSizeLimit", 10 * 1024 * 1024);
  const continueOnError = optionWithFallback("continueOnError", false);
  const isoTime = optionWithFallback("isoTime", false);
  const isoDate = optionWithFallback("isoDate", false);
  const isoDateTime = optionWithFallback("isoDateTime", false);
  const isoTimestamp = optionWithFallback("isoTimestamp", false);
  const isoDateTimeOffset = optionWithFallback("isoDateTimeOffset", false);
  const bodyParserLimit = optionWithFallback("bodyParserLimit", "100mb");
  const returnComplexNested = optionWithFallback("returnComplexNested", true);
  const returnPrimitivePlain = optionWithFallback("returnPrimitivePlain", true);
  const messageTargetDefault = optionWithFallback("messageTargetDefault", "/#TRANSIENT#");

  const fileUpload = expressFileUpload({
    limits: {
      files: 1,
      fileSize: fileUploadSizeLimit,
    },
  });

  let model = optionWithFallback("model", "all");
  if (Array.isArray(model)) {
    model = model.map((entry) => (entry === "all" ? "*" : entry));
  } else {
    model = model === "all" ? "*" : model;
  }
  model = cds.resolve(model);

  if (cds.mtx && cds.mtx.eventEmitter && cds.env.requires && cds.env.requires.db && cds.env.requires.db.multiTenant) {
    cds.mtx.eventEmitter.on(cds.mtx.events.TENANT_UPDATED, (tenantId) => {
      delete proxyCache[tenantId];
    });
  }

  router.use(
    `/${path}/*`,
    logging.middleware({ appContext: appContext, logNetwork: !disableNetworkLog && !process.env.DISABLE_NETWORK_LOG })
  );

  router.use(`/${path}/*`, async (req, res, next) => {
    try {
      const [authType, token] = (req.headers.authorization && req.headers.authorization.split(" ")) || [];
      if (authType && token) {
        let jwtBody;
        switch (authType) {
          case "Basic":
            req.user = { id: decodeBase64(token).split(":")[0] };
            break;
          case "Bearer":
            jwtBody = decodeJwtTokenBody(token);
            req.user = {
              id: jwtBody.client_id,
              scopes: jwtBody.scope,
            };
            req.tenantId = jwtBody.zid;
            break;
          default:
            break;
        }
      }
    } catch (err) {
      logError(req, "Authorization", err);
    }
    next();
  });

  router.get(`/${path}/*\\$metadata`, async (req, res) => {
    let serviceValid = true;
    try {
      const metadataUrlPath = targetUrl(req);

      // Trace
      traceRequest(req, "Request", req.method, req.originalUrl, req.headers, req.body);
      traceRequest(req, "ProxyRequest", req.method, metadataUrlPath, req.headers, req.body);

      const result = await Promise.all([
        fetch(target + metadataUrlPath, {
          method: "GET",
          headers: fillLoggingHeaders(req, {
            authorization: req.headers.authorization,
          }),
        }),
        (async () => {
          const { csn } = await getMetadata(req);
          req.csn = csn;
          const service = serviceFromRequest(req);
          if (service && service.name) {
            serviceValid = service.valid;
            const { edmx } = await getMetadata(req, service.name);
            return edmx;
          }
        })(),
      ]);
      const [metadataResponse, edmx] = result;
      const headers = convertBasicHeaders(convertToNodeHeaders(metadataResponse.headers));
      delete headers["content-encoding"];
      const metadataBody = await metadataResponse.text();
      let body;
      if (metadataResponse.ok) {
        body = edmx;
      } else {
        body = metadataBody;
      }
      setContentLength(headers, body);

      // Trace
      traceResponse(
        req,
        "Proxy Response",
        metadataResponse.status,
        metadataResponse.statusMessage,
        headers,
        metadataBody
      );

      respond(req, res, metadataResponse.status, headers, body);
    } catch (err) {
      if (serviceValid) {
        // Error
        logError(req, "MetadataRequest", err);
        res.status(500).send("Internal Server Error");
      } else {
        res.status(404).send("Not Found");
      }
    }
  });

  router.use(
    `/${path}/*`,

    // Body Parsers
    (req, res, next) => {
      const contentType = req.header("content-type");
      if (!contentType) {
        return next();
      }

      if (isApplicationJSON(contentType)) {
        express.json({ limit: bodyParserLimit })(req, res, next);
      } else if (isMultipartMixed(contentType)) {
        express.text({ type: "multipart/mixed", limit: bodyParserLimit })(req, res, next);
      } else {
        req.checkUploadBinary = req.method === "POST";
        next();
      }
    },

    // Inject Context
    async (req, res, next) => {
      try {
        const { csn } = await getMetadata(req);
        req.csn = csn;
      } catch (err) {
        // Error
        logError(req, "Request", err);
        res.status(500).send("Internal Server Error");
        return;
      }
      const service = serviceFromRequest(req);
      req.base = base;
      req.service = service.name;
      req.servicePath = service.path;
      req.context = {};
      req.contexts = [];
      req.contentId = {};
      req.lookupContext = {};
      next();
    },

    // File Upload
    async (req, res, next) => {
      if (!req.checkUploadBinary) {
        return next();
      }

      const targetPath = targetUrl(req);
      const url = parseUrl(targetPath, req);
      const definition = contextFromUrl(url, req);
      if (!definition) {
        return next();
      }
      const mediaDataElementName = findElementByAnnotation(definition, "@Core.MediaType");
      if (!mediaDataElementName) {
        return next();
      }

      const handleMediaEntity = async (contentType, filename, headers = {}) => {
        try {
          contentType = contentType || "application/octet-stream";
          const body = {};
          // Custom body
          const caseInsensitiveElements = Object.keys(definition.elements).reduce((result, name) => {
            result[name.toLowerCase()] = definition.elements[name];
            return result;
          }, {});
          Object.keys(headers).forEach((name) => {
            const element = caseInsensitiveElements[name.toLowerCase()];
            if (element) {
              const value = convertDataTypeToV4(headers[name], elementType(element), definition, headers);
              body[element.name] = decodeHeaderValue(definition, element, element.name, value);
            }
          });
          const mediaDataElement = definition.elements[mediaDataElementName];
          const mediaTypeElementName =
            (mediaDataElement["@Core.MediaType"] && mediaDataElement["@Core.MediaType"]["="]) ||
            findElementByAnnotation(definition, "@Core.IsMediaType");
          if (mediaTypeElementName) {
            body[mediaTypeElementName] = contentType;
          }
          const contentDispositionFilenameElementName =
            findElementValueByAnnotation(definition, "@Core.ContentDisposition.Filename") ||
            findElementValueByAnnotation(definition, "@Common.ContentDisposition.Filename");
          if (contentDispositionFilenameElementName && filename) {
            const element = definition.elements[contentDispositionFilenameElementName];
            body[contentDispositionFilenameElementName] = decodeHeaderValue(
              definition,
              element,
              element.name,
              filename
            );
          }
          const url = target + targetPath;
          const postHeaders = fillLoggingHeaders(req, {
            ...headers,
            "content-type": "application/json",
          });
          delete postHeaders["transfer-encoding"];

          // Trace
          traceRequest(req, "ProxyRequest", "POST", url, postHeaders, body);

          const response = await fetch(url, {
            method: "POST",
            headers: postHeaders,
            body: JSON.stringify(body),
          });
          const responseBody = await response.json();
          const responseHeaders = convertToNodeHeaders(response.headers);
          if (!response.ok) {
            res
              .status(response.status)
              .set({
                "content-type": "application/json",
              })
              .send(convertResponseError(responseBody, responseHeaders, definition, req));
            return;
          }

          // Rewrite
          req.method = "PUT";
          req.originalUrl += `(${entityKey(responseBody, definition)})/${mediaDataElementName}`;
          req.baseUrl = req.originalUrl;
          req.overwriteResponse = {
            kind: "uploadBinary",
            statusCode: response.status,
            headers: responseHeaders,
            body: responseBody,
          };

          // Trace
          traceResponse(req, "ProxyResponse", response.status, response.statusText, responseHeaders, responseBody);

          next();
        } catch (err) {
          // Error
          logError(req, "FileUpload", err);
          res.status(500).send("Internal Server Error");
        }
      };

      const headers = req.headers;
      if (isMultipartFormData(headers["content-type"])) {
        fileUpload(req, res, async () => {
          await handleMediaEntity(
            req.body && req.body["content-type"],
            req.body &&
              (req.body["slug"] ||
                req.body["filename"] ||
                contentDispositionFilename(req.body) ||
                contentDispositionFilename(headers) ||
                req.body["name"]),
            req.body
          );
        });
      } else {
        await handleMediaEntity(
          headers["content-type"],
          headers["slug"] || headers["filename"] || contentDispositionFilename(headers) || headers["name"],
          headers
        );
      }
    },

    // Proxy Middleware
    createProxyMiddleware({
      target,
      changeOrigin: true,
      selfHandleResponse: true,
      pathRewrite,
      onProxyReq: (proxyReq, req, res) => {
        convertProxyRequest(proxyReq, req, res);
      },
      onProxyRes: (proxyRes, req, res) => {
        convertProxyResponse(proxyRes, req, res);
      },
    })
  );

  function contentDispositionFilename(headers) {
    const contentDisposition = headers["content-disposition"] || headers["Content-Disposition"];
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/^.*filename="(.*)"$/i);
      return filenameMatch && filenameMatch.pop();
    }
    return null;
  }

  function decodeHeaderValue(entity, element, name, value) {
    if (value === undefined || value === null || value === "" || typeof value !== "string") {
      return value;
    }
    let decodes = [];
    if (Array.isArray(element["@cov2ap.headerDecode"])) {
      decodes = element["@cov2ap.headerDecode"];
    } else if (typeof element["@cov2ap.headerDecode"] === "string") {
      decodes = [element["@cov2ap.headerDecode"]];
    }
    if (decodes.length > 0) {
      decodes.forEach((decode) => {
        switch (decode.toLowerCase()) {
          case "uri":
            value = decodeURI(value);
            break;
          case "uricomponent":
            value = decodeURIComponent(value);
            break;
          case "base64":
            value = decodeBase64(value);
            break;
          default:
            break;
        }
      });
    }
    return value;
  }

  function serviceFromRequest(req) {
    let serviceName;
    let serviceValid = true;
    let servicePath = normalizeSlashes(req.params["0"] || "");
    Object.keys(services).find((path) => {
      if (servicePath.toLowerCase().startsWith(normalizeSlashes(path).toLowerCase())) {
        serviceName = services[path];
        servicePath = stripSlashes(path);
        return true;
      }
      return false;
    });
    if (!serviceName) {
      serviceName = Object.keys(cds.services).find((service) => {
        const path = cds.services[service].path;
        if (path) {
          if (servicePath.toLowerCase().startsWith(normalizeSlashes(path).toLowerCase())) {
            servicePath = stripSlashes(path);
            return true;
          }
        }
        return false;
      });
    }
    if (!serviceName) {
      serviceName = Object.keys(cds.services).find((service) => {
        const path = cds.services[service].path;
        return path === "/";
      });
      if (serviceName) {
        servicePath = "";
      }
    }
    if (!serviceName || !req.csn.definitions[serviceName] || req.csn.definitions[serviceName].kind !== "service") {
      logWarning(req, "Service", "Service definition not found for request path", {
        requestPath: servicePath,
        serviceName,
      });
      serviceValid = false;
    }
    return {
      name: serviceName,
      path: servicePath,
      valid: serviceValid,
    };
  }

  async function getMetadata(req, service) {
    let metadata;
    if (mtxRemote && mtxEndpoint) {
      metadata = await getTenantMetadataRemote(req, service);
    } else if (cds.mtx && cds.env.requires && cds.env.requires.db && cds.env.requires.db.multiTenant) {
      metadata = await getTenantMetadataLocal(req, service);
    }
    if (!metadata) {
      metadata = await getDefaultMetadata(req, service);
    }
    return metadata;
  }

  async function getTenantMetadataRemote(req, service) {
    if (req.tenantId) {
      return await compileService(
        determineLocale(req),
        req.tenantId,
        async () => {
          const mtxBasePath =
            mtxEndpoint.startsWith("http://") || mtxEndpoint.startsWith("https://")
              ? mtxEndpoint
              : `${target}${mtxEndpoint}`;
          const response = await fetch(`${mtxBasePath}/metadata/csn/${req.tenantId}`, {
            method: "GET",
            headers: fillLoggingHeaders(req, {
              authorization: req.headers.authorization,
            }),
          });
          if (!response.ok) {
            throw new Error(await response.text());
          }
          return response.json();
        },
        service
      );
    }
  }

  async function getTenantMetadataLocal(req, service) {
    if (req.tenantId) {
      if (!proxyCache[req.tenantId]) {
        proxyCache[req.tenantId] = {
          isExtended: await cds.mtx.isExtended(req.tenantId),
        };
      }
      if (proxyCache[req.tenantId].isExtended) {
        return await compileService(
          determineLocale(req),
          req.tenantId,
          async () => {
            return await cds.mtx.getCsn(req.tenantId);
          },
          service
        );
      }
    }
  }

  async function getDefaultMetadata(req, service) {
    return await compileService(
      determineLocale(req),
      DefaultTenant,
      async () => {
        if (typeof model === "object" && !Array.isArray(model)) {
          return model;
        }
        return await cds.load(model);
      },
      service
    );
  }

  async function compileService(locale, tenantId, loadCsn, service) {
    if (!(proxyCache[tenantId] && proxyCache[tenantId].csn)) {
      let csnRaw;
      if (cds.server && cds.model && tenantId === DefaultTenant) {
        csnRaw = cds.model;
      } else {
        csnRaw = await loadCsn();
      }
      const csn =
        csnRaw.meta && csnRaw.meta.transformation === "odata" ? csnRaw : cds.linked(cds.compile.for.odata(csnRaw));
      proxyCache[tenantId] = {
        ...(proxyCache[tenantId] || {}),
        csnRaw,
        csn,
        edmx: {},
      };
    }
    if (service) {
      proxyCache[tenantId].edmx[service] = proxyCache[tenantId].edmx[service] || {};
      if (!(proxyCache[tenantId].edmx[service] && proxyCache[tenantId].edmx[service][locale])) {
        const edmx = await cds.compile.to.edmx(proxyCache[tenantId].csnRaw, {
          service,
          version: "v2",
        });
        proxyCache[tenantId].edmx[service][locale] = cds.localize(proxyCache[tenantId].csnRaw, locale, edmx);
      }
    }
    return {
      csn: proxyCache[tenantId].csn,
      edmx: service && proxyCache[tenantId].edmx[service][locale],
    };
  }

  function localName(name) {
    return name.split(".").pop();
  }

  function localEntityName(definition, req) {
    const parts = definition.name.split(".");
    const localName = [parts.pop()];
    while (parts.length > 0) {
      const context = req.csn.definitions[parts.join(".")];
      if (context && context.kind === "entity") {
        localName.unshift(parts.pop());
      } else {
        break;
      }
    }
    return localName.join("_");
  }

  function lookupDefinition(name, req) {
    const serviceNamespacePrefix = `${req.service}.`;
    const definitionName = (name.startsWith(serviceNamespacePrefix) ? "" : serviceNamespacePrefix) + name;
    return req.csn.definitions[definitionName] || req.csn.definitions[name];
  }

  function lookupBoundDefinition(name, req) {
    let boundAction = undefined;
    Object.keys(req.csn.definitions).find((definitionName) => {
      const definition = req.csn.definitions[definitionName];
      return Object.keys(definition.actions || {}).find((actionName) => {
        if (name.endsWith(`_${actionName}`)) {
          const entityName = name.substr(0, name.length - `_${actionName}`.length);
          const entityDefinition = lookupDefinition(entityName, req);
          if (entityDefinition === definition) {
            boundAction = definition.actions[actionName];
            req.lookupContext.boundDefinition = definition;
            req.lookupContext.operation = boundAction;
            const returnDefinition = lookupReturnDefinition(boundAction.returns, req);
            if (returnDefinition) {
              req.lookupContext.returnDefinition = returnDefinition;
            }
            return true;
          }
        }
        return false;
      });
    });
    return boundAction;
  }

  /**
   * Convert Proxy Request (v2 -> v4)
   * @param proxyReq Proxy Request
   * @param req Request
   * @param res Response
   */
  async function convertProxyRequest(proxyReq, req, res) {
    // Trace
    traceRequest(req, "Request", req.method, req.originalUrl, req.headers, req.body);

    const headers = fillLoggingHeaders(req, req.headers);
    let body = req.body;
    let contentType = req.header("content-type");

    if (isMultipartMixed(contentType)) {
      // Multipart
      req.contentIdOrder = [];
      body = processMultipartMixed(
        req,
        req.body,
        contentType,
        ({ method, url }) => {
          return {
            method: method === "MERGE" ? "PATCH" : method,
            url: convertUrl(url, req),
          };
        },
        ({ contentType, body, headers, url, contentId }) => {
          if (contentId) {
            req.contentId[`$${contentId}`] = req.context.url;
          }
          delete headers.dataserviceversion;
          delete headers.DataServiceVersion;
          delete headers.maxdataserviceversion;
          delete headers.MaxDataServiceVersion;
          if (isApplicationJSON(contentType)) {
            if (ieee754Compatible) {
              contentType = enrichApplicationJSON(contentType);
              headers["content-type"] = contentType;
            }
            body = convertRequestBody(body, headers, url, req);
          }
          return { body, headers };
        },
        req.contentIdOrder,
        ProcessingDirection.Request
      );
      headers.accept = "multipart/mixed,application/json";
      proxyReq.setHeader("accept", headers.accept);
    } else {
      // Single
      proxyReq.path = convertUrl(proxyReq.path, req);
      if (req.context.serviceRoot && (!headers.accept || headers.accept.includes("xml"))) {
        req.context.serviceRootAsXML = true;
        headers.accept = "application/json";
        proxyReq.setHeader("accept", headers.accept);
      } else if (headers.accept && !headers.accept.includes("application/json")) {
        headers.accept = "application/json," + headers.accept;
        proxyReq.setHeader("accept", headers.accept);
      }
      if (isApplicationJSON(contentType)) {
        if (ieee754Compatible) {
          contentType = enrichApplicationJSON(contentType);
          headers["content-type"] = contentType;
        }
        body = convertRequestBody(req.body, req.headers, proxyReq.path, req);
      }
    }

    Object.entries(headers).forEach(([name, value]) => {
      if (
        name === "dataserviceversion" ||
        name === "DataServiceVersion" ||
        name === "maxdataserviceversion" ||
        name === "MaxDataServiceVersion"
      ) {
        delete headers[name];
        proxyReq.removeHeader(name);
      }
    });

    if (continueOnError) {
      headers["prefer"] = "odata.continue-on-error";
      proxyReq.setHeader("prefer", "odata.continue-on-error");
    }
    headers["x-cds-odata-version"] = "v2";
    proxyReq.setHeader("x-cds-odata-version", "v2");

    if (req.body) {
      delete req.body;
    }
    if (headers["x-http-method"]) {
      proxyReq.method = headers["x-http-method"].toUpperCase();
    }
    proxyReq.method = proxyReq.method === "MERGE" ? "PATCH" : proxyReq.method;

    if (contentType) {
      if (body !== undefined) {
        // File Upload
        if (req.files && Object.keys(req.files).length === 1) {
          const file = req.files[Object.keys(req.files)[0]];
          contentType = body["content-type"] || file.mimetype;
          body = file.data;
        }
        proxyReq.setHeader("content-type", contentType);
        proxyReq.setHeader("content-length", Buffer.byteLength(body));
        proxyReq.write(body);
        proxyReq.end();
      } else if ((req.header("transfer-encoding") || "").includes("chunked")) {
        proxyReq.setHeader("content-type", contentType);
        req.pipe(proxyReq);
      }
    }

    // Trace
    traceRequest(req, "ProxyRequest", proxyReq.method, proxyReq.path, headers, body);
  }

  function convertUrl(urlPath, req) {
    let url = parseUrl(urlPath, req);
    const definition = lookupContextFromUrl(url, req);
    enrichRequest(definition, url, urlPath, req);

    // Order is important
    convertUrlLinks(url, req);
    convertUrlDataTypes(url, req);
    convertUrlCount(url, req);
    convertDraft(url, req);
    convertActionFunction(url, req);
    convertFilter(url, req);
    convertExpandSelect(url, req);
    convertSearch(url, req);
    convertAnalytics(url, req);
    convertValue(url, req);

    delete url.search;
    url.pathname = url.basePath + url.servicePath + url.contextPath;
    return URL.format(url);
  }

  function parseUrl(urlPath, req) {
    const url = URL.parse(urlPath, true);
    url.pathname = (url.pathname && url.pathname.replace(/%27/g, "'")) || "";
    url.originalUrl = { ...url, query: { ...url.query } };
    url.basePath = "";
    url.servicePath = "";
    url.contextPath = url.pathname;
    if (req.base && url.contextPath.startsWith(`/${req.base}`)) {
      url.basePath = `/${req.base}`;
      url.contextPath = url.contextPath.substr(url.basePath.length);
    }
    if (url.contextPath.startsWith(`/${req.servicePath}`)) {
      url.servicePath = `/${req.servicePath}`;
      url.contextPath = url.contextPath.substr(url.servicePath.length);
    }
    if (url.contextPath.startsWith("/")) {
      url.servicePath += "/";
      url.contextPath = url.contextPath.substr(1);
    }
    url.originalUrl.servicePath = url.servicePath;
    url.originalUrl.contextPath = url.contextPath;
    // Normalize system and reserved query parameters (no array), others not (if array)
    Object.keys(url.query || {}).forEach((name) => {
      if (Array.isArray(url.query[name])) {
        if (name.startsWith("$") || ["search", "SideEffectsQualifier"].includes(name)) {
          url.query[name] = url.query[name][0] || "";
        }
      }
    });
    return url;
  }

  function lookupContextFromUrl(url, req, context) {
    req.lookupContext = {};
    return contextFromUrl(url, req, context);
  }

  function contextFromUrl(url, req, context, suppressWarning) {
    let stop = false;
    return url.contextPath.split("/").reduce((context, part) => {
      if (stop) {
        return context;
      }
      const keyStart = part.indexOf("(");
      if (keyStart !== -1) {
        part = part.substr(0, keyStart);
      }
      context = lookupContext(part, context, req, suppressWarning);
      if (!context) {
        stop = true;
      }
      return context;
    }, context);
  }

  function lookupContext(name, context, req, suppressWarning) {
    if (!name) {
      return context;
    }
    if (!context) {
      if (name.startsWith("$") && req.contentId[name]) {
        return contextFromUrl(req.contentId[name], req, undefined, suppressWarning);
      } else {
        context = lookupDefinition(name, req);
        if (!context) {
          context = lookupBoundDefinition(name, req);
        }
        if (!context && !suppressWarning) {
          logWarning(req, "Context", "Definition name not found", {
            name,
          });
        }
        if (context && (context.kind === "function" || context.kind === "action")) {
          req.lookupContext.operation = context;
          const returnDefinition = lookupReturnDefinition(context.returns, req);
          if (returnDefinition) {
            req.lookupContext.returnDefinition = returnDefinition;
          }
        }
        return context;
      }
    } else {
      if (name.startsWith("$")) {
        return context;
      }
      if (context.kind === "function" || context.kind === "action") {
        req.lookupContext.operation = context;
        const returnDefinition = lookupReturnDefinition(context.returns, req);
        if (returnDefinition) {
          context = returnDefinition;
          req.lookupContext.returnDefinition = context;
        }
      }
      const element = context && context.elements && context.elements[name];
      if (element) {
        const type = elementType(element);
        if (type === "cds.Composition" || type === "cds.Association") {
          // Navigation
          return element._target;
        } else {
          // Element
          return context;
        }
      }
      if (context && context.params && name === "Set") {
        return context;
      }
      if (!suppressWarning) {
        logWarning(req, "Context", "Definition name not found", {
          name,
        });
      }
    }
  }

  function enrichRequest(definition, url, urlPath, req) {
    req.context = {
      url,
      urlPath,
      serviceRoot: url.contextPath.length === 0,
      serviceRootAsXML: false,
      definition: definition,
      requestDefinition: definition,
      serviceUri: "",
      operation: null,
      boundDefinition: null,
      returnDefinition: null,
      bodyParameters: {},
      $entityValue: false,
      $value: false,
      $count: false,
      $apply: null,
      aggregationKey: false,
      aggregationFilter: "",
      ...req.lookupContext,
    };
    req.contexts.push(req.context);
    return req.context;
  }

  function convertUrlLinks(url, req) {
    url.contextPath = url.contextPath.replace(/\/\$links\//gi, "/");
  }

  function convertUrlDataTypes(url, req) {
    // Keys & Parameters
    let context;
    let stop = false;
    url.contextPath = url.contextPath
      .split("/")
      .map((part) => {
        if (stop) {
          return part;
        }
        let keyPart = "";
        const keyStart = part.indexOf("(");
        const keyEnd = part.lastIndexOf(")");
        if (keyStart !== -1 && keyEnd === part.length - 1) {
          keyPart = part.substring(keyStart + 1, keyEnd);
          part = part.substr(0, keyStart);
        }
        context = lookupContext(part, context, req);
        if (!context) {
          stop = true;
        }
        if (context && context.elements && keyPart) {
          const aggregationMatch = keyPart.match(/^aggregation'(.*)'$/i);
          const aggregationKey = aggregationMatch && aggregationMatch.pop();
          if (aggregationKey) {
            // Aggregation Key
            try {
              const aggregation = JSON.parse(decodeURIKey(aggregationKey));
              url.query["$select"] = (aggregation.value || []).join(",");
              delete url.query["$filter"];
              if (Object.keys(aggregation.key || {}).length > 0) {
                url.query["$filter"] = Object.keys(aggregation.key || {})
                  .map((name) => {
                    return `${name} eq ${aggregation.key[name]}`;
                  })
                  .join(" and ");
              }
              if (aggregation.filter) {
                if (!url.query["$filter"]) {
                  url.query["$filter"] = aggregation.filter;
                } else {
                  url.query["$filter"] = `(${url.query["$filter"]}) and (${aggregation.filter})`;
                }
                req.context.aggregationFilter = aggregation.filter;
              }
              req.context.aggregationKey = true;
              return part;
            } catch (err) {
              // Error
              logError(req, "AggregationKey", err);
            }
          } else {
            const keys = keyPart.split(",");
            return `${part}(${keys.map((key) => {
              const [name, value] = key.split("=");
              let type;
              if (name && value) {
                if (context.params && context.params[name]) {
                  type = context.params[name].type;
                }
                if (!type) {
                  type = context.elements[name] && elementType(context.elements[name]);
                }
                return `${name}=${replaceConvertDataTypeToV4(value, type)}`;
              } else if (name && context.keys) {
                const key = Object.keys(context.keys).find((key) => {
                  return context.keys[key].type !== "cds.Composition" && context.keys[key].type !== "cds.Association";
                });
                type = key && context.elements[key] && elementType(context.elements[key]);
                return type && `${replaceConvertDataTypeToV4(name, type)}`;
              }
              return "";
            })})`;
          }
        } else {
          return part;
        }
      })
      .join("/");

    // Query
    Object.keys(url.query).forEach((name) => {
      if (name === "$filter") {
        url.query[name] = convertUrlDataTypesForFilter(url.query[name], context);
      } else if (!name.startsWith("$")) {
        if (context && context.elements && context.elements[name]) {
          const element = context.elements[name];
          const type = elementType(element);
          if (DataTypeMap[type]) {
            url.query[name] = replaceConvertDataTypeToV4(url.query[name], type);
          }
        }
        if (context && (context.kind === "function" || context.kind === "action")) {
          if (context.params && context.params[name]) {
            const element = context.params[name];
            const type = elementType(element);
            if (DataTypeMap[type]) {
              url.query[name] = replaceConvertDataTypeToV4(url.query[name], type);
            }
          }
          if (context.parent && context.parent.kind === "entity") {
            if (context.parent && context.parent.elements && context.parent.elements[name]) {
              const element = context.parent.elements[name];
              const type = elementType(element);
              if (DataTypeMap[type]) {
                url.query[name] = replaceConvertDataTypeToV4(url.query[name], type);
              }
            }
          }
        }
      }
    });
  }

  function buildQuoteParts(input) {
    let quote = false;
    let quoteEscape = false;
    let quoteTypeStart = false;
    let part = "";
    const parts = [];
    input.split("").forEach((char, index) => {
      part += char;
      if (char === "'") {
        if (quote) {
          if (quoteEscape) {
            quoteEscape = false;
            return;
          }
          const nextChar = input.substr(index + 1, 1);
          if (nextChar === "'") {
            quoteEscape = true;
            return;
          }
        }
        const typeStart = !!Object.keys(DataTypeMap)
          .filter((type) => type !== "cds.String")
          .find((type) => {
            const v2Pattern = DataTypeMap[type].v2;
            return v2Pattern.includes("'") && part.endsWith(v2Pattern.split("'").shift() + "'");
          });
        if (!typeStart && !quoteTypeStart) {
          if (part.length > 0) {
            parts.push({
              content: part,
              quote: quote,
            });
            part = "";
          }
          quote = !quote;
        }
        quoteTypeStart = typeStart;
      }
    });
    if (part.length > 0) {
      parts.push({
        content: part,
        quote: quote,
      });
    }
    return parts;
  }

  function convertUrlDataTypesForFilter(filter, context) {
    return buildQuoteParts(filter)
      .map((part) => {
        if (!part.quote) {
          convertUrlDataTypesForFilterElements(part, context);
        }
        return part.content;
      })
      .join("");
  }

  function convertUrlDataTypesForFilterElements(part, entity, path = "", depth = 0) {
    if (entity && entity.elements) {
      for (let name of Object.keys(entity.elements)) {
        const namePath = (path ? `${path}/` : "") + name;
        if (part.content.includes(namePath)) {
          const element = entity.elements[name];
          const type = elementType(element);
          if (type !== "cds.Composition" && type !== "cds.Association") {
            if (DataTypeMap[type]) {
              const v4Regex = new RegExp(
                `(${namePath})(\\)?\\s+?(?:eq|ne|gt|ge|lt|le)\\s+?)${DataTypeMap[type].v4.source}`,
                DataTypeMap[type].v4.flags
              );
              if (v4Regex.test(part.content)) {
                part.content = part.content.replace(v4Regex, (_, name, op, value) => {
                  return `${name}${op}${convertDataTypeToV4(value, type)}`;
                });
              }
            }
          } else if (depth < 3 && (!element.cardinality || element.cardinality.max !== "*")) {
            convertUrlDataTypesForFilterElements(part, element._target, namePath, depth + 1);
          }
        }
      }
    }
  }

  function convertUrlCount(url, req) {
    if (url.query["$inlinecount"]) {
      url.query["$count"] = url.query["$inlinecount"] === "allpages";
      req.context.$count = url.query["$count"];
      delete url.query["$inlinecount"];
    }
    return url;
  }

  function convertDraft(url, req) {
    if (
      req.context &&
      req.context.definition &&
      req.context.definition.kind === "action" &&
      req.context.definition.params &&
      req.context.definition.params.SideEffectsQualifier
    ) {
      url.query.SideEffectsQualifier = url.query.SideEffectsQualifier || "";
    }
  }

  function convertActionFunction(url, req) {
    const definition = req.context && (req.context.operation || req.context.definition);
    if (!(definition && (definition.kind === "function" || definition.kind === "action"))) {
      return;
    }
    const operationLocalName = localEntityName(definition, req);
    let reqContextPathSuffix = "";
    if (url.contextPath.startsWith(operationLocalName)) {
      reqContextPathSuffix = url.contextPath.substr(operationLocalName.length);
      url.contextPath = url.contextPath.substr(0, operationLocalName.length);
    }
    // Key Parameters
    if (definition.parent && definition.parent.kind === "entity") {
      url.contextPath = localEntityName(definition.parent, req);
      url.contextPath += `(${Object.keys(definition.parent.keys || {})
        .reduce((result, name) => {
          const element = definition.parent.elements && definition.parent.elements[name];
          const value = url.query[name] || "";
          result.push(`${name}=${quoteParameter(element, value, req)}`);
          delete url.query[name];
          return result;
        }, [])
        .join(",")})`;
      url.contextPath += `/${req.service}.${definition.name}`;
    }
    // Function Parameters
    if (definition.kind === "function") {
      url.contextPath += `(${Object.keys(url.query)
        .reduce((result, name) => {
          if (!name.startsWith("$")) {
            const element = definition.params && definition.params[name];
            if (element) {
              let value = url.query[name] || "";
              if (Array.isArray(value)) {
                value = value.map((entry) => {
                  return quoteParameter(element, encodeURIComponent(entry), req);
                });
              } else {
                value = quoteParameter(element, encodeURIComponent(value), req);
                if (element.items && element.items.type) {
                  value = [value];
                }
              }
              if (Array.isArray(value)) {
                result.push(`${name}=@${name}Col`);
                value = value.map((entry) => {
                  return quoteParameter(element, entry, req, '"');
                });
                url.query[`@${name}Col`] = `[${value}]`;
              } else {
                result.push(`${name}=${value}`);
              }
              delete url.query[name];
            }
          }
          return result;
        }, [])
        .join(",")})`;
    }
    url.contextPath += reqContextPathSuffix;
    // Action Body
    if (definition.kind === "action") {
      Object.keys(url.query).forEach((name) => {
        if (!name.startsWith("$")) {
          const element = definition.params && definition.params[name];
          if (element) {
            let value = url.query[name] || "";
            if (Array.isArray(value)) {
              value = value.map((entry) => {
                return unquoteParameter(element, entry, req);
              });
            } else {
              value = unquoteParameter(element, value, req);
              if (element.items && element.items.type) {
                value = [value];
              }
            }
            url.query[name] = value;
          }
        }
      });
      req.context.bodyParameters = url.query || {};
      url.query = {};
    }
  }

  function quoteParameter(element, value, req, quote = "'") {
    if (!element || ["cds.String", "cds.LargeString"].includes(elementType(element))) {
      return `${quote}${value.replace(/^["'](.*)["']$/, "$1")}${quote}`;
    }
    return value;
  }

  function unquoteParameter(element, value, req) {
    if (
      !element ||
      ["cds.Date", "cds.Time", "cds.DateTime", "cds.Timestamp", "cds.String", "cds.LargeString"].includes(
        elementType(element)
      )
    ) {
      return value.replace(/^["'](.*)["']$/, "$1");
    }
    return value;
  }

  function stripSlashes(path) {
    return path && path.replace(/^\/|\/$/g, "");
  }

  function normalizeSlashes(path) {
    path = stripSlashes(path);
    return path ? `/${path}/` : "/";
  }

  function convertExpandSelect(url, req) {
    const definition = req.context && req.context.definition;
    if (definition) {
      const context = { select: {}, expand: {} };
      if (url.query["$expand"]) {
        const expands = url.query["$expand"].split(",");
        expands.forEach((expand) => {
          let current = context.expand;
          expand.split("/").forEach((part) => {
            current[part] = current[part] || { select: {}, expand: {} };
            current = current[part].expand;
          });
        });
      }
      if (url.query["$select"]) {
        const selects = url.query["$select"].split(",");
        selects.forEach((select) => {
          let current = context;
          let currentDefinition = definition;
          select.split("/").forEach((part) => {
            if (!current) {
              return;
            }
            const element = currentDefinition.elements && currentDefinition.elements[part];
            if (element) {
              const type = elementType(element);
              if (type === "cds.Composition" || type === "cds.Association") {
                current = current && current.expand[part];
                currentDefinition = element._target;
              } else if (current && current.select) {
                current.select[part] = true;
              }
            }
          });
        });
        if (Object.keys(context.select).length > 0) {
          url.query["$select"] = Object.keys(context.select).join(",");
        } else {
          delete url.query["$select"];
        }
      }
      if (url.query["$expand"]) {
        const serializeExpand = (expand) => {
          return Object.keys(expand || {})
            .map((name) => {
              let value = expand[name];
              let result = name;
              const selects = Object.keys(value.select);
              const expands = Object.keys(value.expand);
              if (selects.length > 0 || expands.length > 0) {
                result += "(";
                if (selects.length > 0) {
                  result += `$select=${selects.join(",")}`;
                }
                if (expands.length > 0) {
                  if (selects.length > 0) {
                    result += ";";
                  }
                  result += `$expand=${serializeExpand(value.expand)}`;
                }
                result += ")";
              }
              return result;
            })
            .join(",");
        };
        if (Object.keys(context.expand).length > 0) {
          url.query["$expand"] = serializeExpand(context.expand);
        } else {
          delete url.query["$expand"];
        }
      }
    }
  }

  function convertFilter(url, req) {
    const _ = "§§";

    let filter = url.query["$filter"];
    if (filter) {
      let quote = false;
      let lookBehind = "";
      let bracket = 0;
      let brackets = [];
      let bracketMax = 0;

      filter = filter
        .split("")
        .map((char) => {
          if (char === "'") {
            quote = !quote;
          }
          if (!quote) {
            if (char === "(") {
              bracket++;
              const filterFunctionStart = !!Object.keys(FilterFunctions).find((name) => {
                return lookBehind.endsWith(name.split("(").shift());
              });
              if (filterFunctionStart) {
                brackets.push(bracket - 1);
                bracketMax = Math.max(bracketMax, brackets.length);
                return `${_}(${brackets.length}${_}`;
              }
            } else if (char === ")") {
              bracket--;
              const [mark] = brackets.slice(-1);
              if (mark === bracket) {
                brackets.pop();
                return `${_})${brackets.length + 1}${_}`;
              }
            } else if (char === ",") {
              if (brackets.length > 0) {
                return `${_},${brackets.length}${_}`;
              }
            }
            lookBehind += char;
          } else {
            lookBehind = "";
          }
          return char;
        })
        .join("");

      if (bracketMax > 0) {
        for (let i = 1; i <= bracketMax; i++) {
          Object.keys(FilterFunctions).forEach((name) => {
            let pattern = name
              .replace(/([()])/g, `${_}\\$1${i}${_}`)
              .replace(/([,])/g, `${_}$1${i}${_}`)
              .replace(/[$]/g, "(.*?)");
            filter = filter.replace(new RegExp(pattern, "gi"), FilterFunctions[name]);
          });
          filter = filter.replace(new RegExp(`${_}([(),])${i}${_}`, "g"), "$1");
        }
        url.query["$filter"] = filter;
      }
    }
  }

  function convertSearch(url, req) {
    if (url.query.search) {
      url.query["$search"] = `"${url.query.search}"`;
      delete url.query.search;
    }
  }

  function convertAnalytics(url, req) {
    const definition = req.context && req.context.definition;
    if (
      !(
        definition &&
        definition.kind === "entity" &&
        definition["@cov2ap.analytics"] !== false &&
        url.query["$select"] &&
        (definition["@Analytics"] ||
          definition["@Analytics.query"] ||
          definition["@Aggregation.ApplySupported.PropertyRestrictions"] ||
          definition["@sap.semantics"] === "aggregate")
      )
    ) {
      return;
    }
    const measures = [];
    const dimensions = [];
    const selects = url.query["$select"].split(",");
    const values = [];
    selects.forEach((select) => {
      const element = definition.elements && definition.elements[select];
      if (element) {
        values.push(element);
      }
    });
    selects.forEach((select) => {
      const element = definition.elements && definition.elements[select];
      if (element) {
        if (element["@Analytics.Measure"] || element["@sap.aggregation.role"] === "measure") {
          measures.push(element);
        } else {
          // element["@Analytics.Dimension"] || element["@sap.aggregation.role"] === "dimension"
          dimensions.push(element);
        }
      }
    });

    if (dimensions.length > 0 || measures.length > 0) {
      url.query["$apply"] = "";
      if (dimensions.length) {
        url.query["$apply"] = "groupby(";
        url.query["$apply"] += `(${dimensions
          .map((dimension) => {
            return dimension.name;
          })
          .join(",")})`;
      }
      if (measures.length > 0) {
        if (url.query["$apply"]) {
          url.query["$apply"] += ",";
        }
        url.query["$apply"] += `aggregate(${measures
          .map((measure) => {
            const aggregation = measure["@Aggregation.default"] || measure["@DefaultAggregation"];
            const aggregationName = aggregation ? aggregation["#"] || aggregation : DefaultAggregation;
            const aggregationFunction = aggregationName ? AggregationMap[aggregationName.toUpperCase()] : undefined;
            if (!aggregationFunction) {
              throw new Error(`Aggregation '${aggregationName}' is not supported`);
            }
            return `${measure.name} with ${aggregationFunction} as ${AggregationPrefix}${measure.name}`;
          })
          .join(",")})`;
      }
      if (dimensions.length) {
        url.query["$apply"] += ")";
      }

      const filter = url.query["$filter"];
      if (filter) {
        url.query["$apply"] = `filter(${filter})/` + url.query["$apply"];
      }

      if (url.query["$orderby"]) {
        url.query["$orderby"] = url.query["$orderby"]
          .split(",")
          .map((orderBy) => {
            let [name, order] = orderBy.split(" ");
            const element = definition.elements && definition.elements[name];
            if (element && (element["@Analytics.Measure"] || element["@sap.aggregation.role"] === "measure")) {
              name = `${AggregationPrefix}${element.name}`;
            }
            return name + (order ? ` ${order}` : "");
          })
          .join(",");
      }

      delete url.query["$filter"];
      delete url.query["$select"];
      delete url.query["$expand"];

      req.context.$apply = {
        key: dimensions,
        value: values,
        filter: req.context.aggregationKey ? req.context.aggregationFilter : filter,
      };
    }
  }

  function convertValue(url, req) {
    if (url.contextPath.endsWith("/$value")) {
      url.contextPath = url.contextPath.substr(0, url.contextPath.length - "/$value".length);
      const mediaDataElementName =
        req.context && req.context.definition && findElementByAnnotation(req.context.definition, "@Core.MediaType");
      const endingElementName = findEndingElementName(req.context.definition, url);
      if (!endingElementName) {
        url.contextPath += `/${mediaDataElementName}`;
        req.context.$entityValue = true;
      } else if (endingElementName !== mediaDataElementName) {
        req.context.$value = true;
      }
    }
  }

  function convertRequestBody(body, headers, url, req) {
    let definition = req.context && req.context.definition;
    if (definition) {
      if (definition.kind === "action") {
        body = Object.assign({}, body, req.context.bodyParameters);
        definition = {
          elements: definition.params || {},
        };
      }
      convertRequestData(body, headers, definition, req);
    }
    return JSON.stringify(body);
  }

  function convertRequestData(data, headers, definition, req) {
    if (!Array.isArray(data)) {
      return convertRequestData([data], headers, definition, req);
    }
    if (!definition.elements) {
      return;
    }
    // Modify Payload
    data.forEach((data) => {
      delete data.__metadata;
      delete data.__count;
      convertDataTypesToV4(data, headers, definition, data, req);
    });
    // Recursion
    data.forEach((data) => {
      Object.keys(data).forEach((key) => {
        const element = definition.elements[key];
        const type = elementType(element);
        if (element && (type === "cds.Composition" || type === "cds.Association")) {
          if (data[key] && data[key].__deferred) {
            delete data[key];
          } else {
            if (data[key] !== null) {
              if (Array.isArray(data[key].results)) {
                data[key] = data[key].results;
              }
              convertRequestData(data[key], headers, element._target, req);
            } else {
              delete data[key];
            }
          }
        }
      });
    });
  }

  function convertDataTypesToV4(data, headers, definition, body, req) {
    Object.keys(data || {}).forEach((key) => {
      if (data[key] === null) {
        return;
      }
      const element = definition.elements && definition.elements[key];
      if (element) {
        data[key] = convertDataTypeToV4(data[key], elementType(element), definition, headers);
      }
    });
  }

  function replaceConvertDataTypeToV4(value, type, definition, headers = {}) {
    if (value === null || value === undefined) {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((entry) => {
        return replaceConvertDataTypeToV4(entry, type, definition, headers);
      });
    }
    if (DataTypeMap[type]) {
      value = value.replace(DataTypeMap[type].v4, "$1");
    }
    return convertDataTypeToV4(value, type);
  }

  function convertDataTypeToV4(value, type, definition, headers = {}) {
    if (value === null || value === undefined) {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((entry) => {
        return convertDataTypeToV4(entry, type, definition, headers);
      });
    }
    const contentType = headers["content-type"];
    const ieee754Compatible = contentType && contentType.includes(IEEE754Compatible);
    if (["cds.Boolean"].includes(type)) {
      if (value === "true") {
        value = true;
      } else if (value === "false") {
        value = false;
      }
    } else if (["cds.Integer"].includes(type)) {
      value = parseInt(value, 10);
    } else if (["cds.Integer64", "cds.Decimal", "cds.DecimalFloat"].includes(type)) {
      value = ieee754Compatible ? `${value}` : parseFloat(value);
    } else if (["cds.Double"].includes(type)) {
      value = parseFloat(value);
    } else if (["cds.Time"].includes(type)) {
      const match = value.match(DurationRegex);
      if (match) {
        value = `${match[4] || "00"}:${match[5] || "00"}:${match[6] || "00"}`;
      }
    } else if (["cds.Date", "cds.DateTime", "cds.Timestamp"].includes(type)) {
      const match = value.match(/\/Date\((.*)\)\//);
      const ticksAndOffset = match && match.pop();
      if (ticksAndOffset) {
        value = new Date(calculateTicksOffsetSum(ticksAndOffset)).toISOString(); // always UTC
      }
      if (["cds.DateTime"].includes(type)) {
        value = value.slice(0, 19) + "Z"; // Cut millis
      } else if (["cds.Date"].includes(type)) {
        value = value.slice(0, 10); // Cut time
      }
    }
    return value;
  }

  function calculateTicksOffsetSum(text) {
    return (text.replace(/\s/g, "").match(/[+-]?([0-9]+)/g) || []).reduce((sum, value, index) => {
      return sum + parseFloat(value) * (index === 0 ? 1 : 60 * 1000); // ticks are milliseconds (0), offset are minutes (1)
    }, 0);
  }

  function initContext(req, index = 0) {
    req.context = req.contexts[index] || {};
    return req.context.definition && req.context.definition.kind === "entity"
      ? req.context.definition
      : req.context.boundDefinition;
  }

  /**
   * Convert Proxy Response (v4 -> v2)
   * @param proxyRes Proxy Request
   * @param req Request
   * @param res Response
   */
  async function convertProxyResponse(proxyRes, req, res) {
    try {
      req.context = {};
      let statusCode = proxyRes.statusCode;
      let headers = proxyRes.headers;
      if (statusCode < 400 && req.overwriteResponse) {
        statusCode = req.overwriteResponse.statusCode;
        headers = {
          ...req.overwriteResponse.headers,
          ...headers,
        };
      }

      normalizeContentType(headers);

      // Pipe Binary Stream
      const contentType = headers["content-type"];
      const transferEncoding = headers["transfer-encoding"] || "";
      if (transferEncoding.includes("chunked") && !isApplicationJSON(contentType) && !isMultipartMixed(contentType)) {
        return await processStreamResponse(proxyRes, req, res, headers);
      }

      // Body
      let body = await parseProxyResponseBody(proxyRes, headers, req);
      if (statusCode < 400 && req.overwriteResponse) {
        body = {
          ...req.overwriteResponse.body,
          ...body,
        };
      }

      // Trace
      traceResponse(req, "ProxyResponse", proxyRes.statusCode, proxyRes.statusMessage, headers, body);
      delete headers["content-encoding"];

      convertBasicHeaders(headers);
      if (body && statusCode < 400) {
        if (isMultipartMixed(contentType)) {
          // Multipart
          const resContentIdOrder = [];
          body = processMultipartMixed(
            req,
            body,
            contentType,
            null,
            ({ index, statusCode, contentType, body, headers }) => {
              const serviceDefinition = initContext(req, index);
              if (statusCode < 400) {
                convertHeaders(body, headers, serviceDefinition, req);
                if (body && isApplicationJSON(contentType)) {
                  body = convertResponseBody(Object.assign({}, body), headers, req);
                }
              } else {
                convertHeaders(body, headers, serviceDefinition, req);
                body = convertResponseError(body, headers, serviceDefinition, req);
              }
              return { body, headers };
            },
            resContentIdOrder,
            ProcessingDirection.Response
          );
          if (
            !(
              req.contentIdOrder.length === resContentIdOrder.length &&
              req.contentIdOrder.every((contentId, index) => contentId === resContentIdOrder[index])
            )
          ) {
            logWarning(req, "Batch", "Response changeset order does not match request changeset order", {
              requestContentIds: req.contentIdOrder,
              responseContentIds: resContentIdOrder,
            });
          }
          if (statusCode === 200) {
            // OData V4: 200 => OData V2: 202
            statusCode = 202;
          }
        } else {
          // Single
          const serviceDefinition = initContext(req);
          convertHeaders(body, headers, serviceDefinition, req);
          if (isApplicationJSON(contentType)) {
            body = convertResponseBody(Object.assign({}, body), headers, req);
          }
        }
        if (body && !(headers["transfer-encoding"] || "").includes("chunked") && statusCode !== 204) {
          setContentLength(headers, body);
        }
      } else {
        // Failed
        const serviceDefinition = initContext(req);
        convertHeaders(body, headers, serviceDefinition, req);
        body = convertResponseError(body, headers, serviceDefinition, req);
        setContentLength(headers, body);
      }
      respond(req, res, statusCode, headers, body);
    } catch (err) {
      // Error
      logError(req, "Response", err);
      if (proxyRes.body && proxyRes.body.error) {
        respond(
          req,
          res,
          proxyRes.statusCode,
          proxyRes.headers,
          convertResponseError(proxyRes.body, proxyRes.headers, undefined, req)
        );
      } else {
        res.status(500).send("Internal Server Error");
      }
    }
  }

  async function processStreamResponse(proxyRes, req, res, headers) {
    // Trace
    traceResponse(req, "ProxyResponse", proxyRes.statusCode, proxyRes.statusMessage, headers, {});

    let streamRes = proxyRes;
    convertBasicHeaders(headers);
    const context = req.contexts && req.contexts[0];
    if (context && context.definition && context.definition.elements) {
      const mediaDataElementName = findElementByAnnotation(context.definition, "@Core.MediaType");
      if (mediaDataElementName) {
        const parts = proxyRes.req.path.split("/");
        if (parts[parts.length - 1] === "$value" || parts[parts.length - 1].startsWith("$value?")) {
          parts.pop();
        }
        if (parts[parts.length - 1] === mediaDataElementName) {
          parts.pop();
        }

        // Is Url
        const urlElement =
          findElementByAnnotation(context.definition, "@Core.IsURL") ||
          findElementByAnnotation(context.definition, "@Core.IsUrl");
        if (urlElement) {
          const mediaResponse = await fetch(target + parts.join("/"), {
            method: "GET",
            headers: fillLoggingHeaders(req, req.headers),
          });
          if (!mediaResponse.ok) {
            throw new Error(await mediaResponse.text());
          }
          if (mediaResponse) {
            const mediaResult = await mediaResponse.json();
            const mediaReadLink = mediaResult[`${urlElement}@odata.mediaReadLink`];
            if (mediaReadLink) {
              try {
                const mediaResponse = await fetch(mediaReadLink, {
                  method: "GET",
                  headers: fillLoggingHeaders(req, req.headers),
                });
                res.status(mediaResponse.status);
                headers = convertBasicHeaders(convertToNodeHeaders(mediaResponse.headers));
                streamRes = mediaResponse.body;
              } catch (err) {
                logError(req, "MediaStream", err);
                const errorBody = convertResponseError({ error: err }, {}, context.definition, req);
                respond(req, res, 500, { "content-type": "application/json" }, errorBody);
                return;
              }
            }
          }
        } else {
          // Is Binary
          const contentDispositionFilenameElement =
            findElementValueByAnnotation(context.definition, "@Core.ContentDisposition.Filename") ||
            findElementValueByAnnotation(context.definition, "@Common.ContentDisposition.Filename");
          if (contentDispositionFilenameElement) {
            const response = await fetch(target + [...parts, contentDispositionFilenameElement, "$value"].join("/"), {
              method: "GET",
              headers: fillLoggingHeaders(req, {
                ...req.headers,
                accept: "application/json,*/*",
              }),
            });
            if (response.ok) {
              const filename = await response.text();
              if (filename) {
                headers["content-disposition"] = `inline; filename="${filename}"`;
              }
            } else {
              logError(req, "ContentDisposition", await response.text());
            }
          }
        }
      }
    }

    delete headers["content-encoding"];
    Object.entries(headers).forEach(([name, value]) => {
      res.setHeader(name, value);
    });
    streamRes.pipe(res);

    // Trace
    traceResponse(req, "Response", res.statusCode, res.statusMessage, headers, {});
  }

  async function parseProxyResponseBody(proxyRes, headers, req) {
    const contentType = headers["content-type"];
    let bodyParser;
    if (req.method === "HEAD") {
      bodyParser = null;
    } else if (isApplicationJSON(contentType)) {
      bodyParser = express.json({ limit: bodyParserLimit });
    } else if (isPlainText(contentType) || isXML(contentType)) {
      bodyParser = express.text({ type: () => true, limit: bodyParserLimit });
    } else if (isMultipartMixed(contentType)) {
      bodyParser = express.text({ type: "multipart/mixed", limit: bodyParserLimit });
    }
    if (bodyParser) {
      await promisify(bodyParser)(proxyRes, null);
      return proxyRes.body;
    }
  }

  function convertBasicHeaders(headers) {
    delete headers["odata-version"];
    delete headers["OData-Version"];
    delete headers["odata-entityid"];
    delete headers["OData-EntityId"];
    headers.dataserviceversion = "2.0";
    return headers;
  }

  function convertHeaders(body, headers, serviceDefinition, req) {
    convertBasicHeaders(headers);
    const definition = contextFromBody(body, req);
    if (definition && definition.kind === "entity") {
      convertLocation(body, headers, definition, req);
    }
    convertMessages(body, headers, definition && definition.kind === "entity" ? definition : serviceDefinition, req);
    return headers;
  }

  function convertLocation(body, headers, definition, req) {
    const location = entityUri(body, definition, req);
    if (headers.location || headers.Location) {
      headers.location = location;
    }
    delete headers.Location;
  }

  function convertMessages(body, headers, definition, req) {
    if (headers["sap-messages"]) {
      const messages = JSON.parse(headers["sap-messages"]);
      if (messages && messages.length > 0) {
        const message = convertMessage(messages.shift(), definition, req);
        message.details = messages.map((message) => {
          return convertMessage(message, definition, req);
        });
        headers["sap-message"] = JSON.stringify(message);
      }
      delete headers["sap-messages"];
    }
  }

  function convertMessage(message, definition, req) {
    if (!message) {
      return message;
    }
    message.severity = SeverityMap[message["@Common.numericSeverity"] || message.numericSeverity] || "error";
    delete message.numericSeverity;
    delete message["@Common.numericSeverity"];
    if (message.target) {
      message.target = convertMessageTarget(message.target, req, definition);
    } else if (message.target === undefined && messageTargetDefault) {
      message.target = messageTargetDefault;
    }
    if (Array.isArray(message["@Common.additionalTargets"])) {
      message.additionalTargets = message["@Common.additionalTargets"].map((messageTarget) => {
        return convertMessageTarget(messageTarget, req, definition);
      });
    }
    delete message["@Common.additionalTargets"];
    return message;
  }

  function convertMessageTarget(messageTarget, req, definition) {
    if (!messageTarget) {
      return messageTarget;
    }
    if (req.context.operation && req.context.boundDefinition) {
      const bindingParamaterName = req.context.operation["@cds.odata.bindingparameter.name"] || "in";
      if (messageTarget.startsWith(`${bindingParamaterName}/`)) {
        messageTarget = messageTarget.substr(bindingParamaterName.length + 1);
      }
    }
    let context;
    definition = definition && definition.kind === "entity" ? definition : undefined;
    if (
      contextFromUrl(
        {
          contextPath: messageTarget,
          query: {},
        },
        req,
        undefined,
        true
      )
    ) {
      context = undefined;
    } else if (
      contextFromUrl(
        {
          contextPath: messageTarget,
          query: {},
        },
        req,
        definition,
        true
      )
    ) {
      context = definition;
    }
    let stop = false;
    return messageTarget
      .split("/")
      .map((part) => {
        if (stop) {
          return part;
        }
        let keyPart = "";
        const keyStart = part.indexOf("(");
        const keyEnd = part.lastIndexOf(")");
        if (keyStart !== -1 && keyEnd === part.length - 1) {
          keyPart = part.substring(keyStart + 1, keyEnd);
          part = part.substr(0, keyStart);
        }
        context = lookupContext(part, context, req);
        if (!context) {
          stop = true;
        }
        if (context && context.elements && keyPart) {
          const keys = keyPart.split(",");
          return `${part}(${keys.map((key) => {
            const [name, value] = key.split("=");
            let type;
            if (name && value) {
              if (context.params && context.params[name]) {
                type = context.params[name].type;
              }
              if (!type) {
                type = context.elements[name] && elementType(context.elements[name]);
              }
              return `${name}=${replaceConvertDataTypeToV2(value, type, context)}`;
            } else if (name && context.keys) {
              const key = Object.keys(context.keys).find((key) => {
                return context.keys[key].type !== "cds.Composition" && context.keys[key].type !== "cds.Association";
              });
              type = key && context.elements[key] && elementType(context.elements[key]);
              return type && `${replaceConvertDataTypeToV2(name, type, context)}`;
            }
            return "";
          })})`;
        } else {
          return part;
        }
      })
      .join("/");
  }

  function convertResponseError(body, headers, definition, req) {
    if (!body) {
      return body;
    }
    if (body.error) {
      if (body.error.message) {
        body.error.message = {
          lang: headers["content-language"] || "en",
          value: body.error.message,
        };
      }
      body.error = convertMessage(body.error, definition, req);
      const singleDetailError = Object.assign({}, body.error);
      delete singleDetailError.innererror;
      delete singleDetailError.details;
      singleDetailError.severity = singleDetailError.severity || "error";
      body.error.innererror = body.error.innererror || {};
      body.error.innererror.errordetails = body.error.innererror.errordetails || [];
      if (body.error.details) {
        body.error.innererror.errordetails.push(
          ...body.error.details.map((detail) => {
            return convertMessage(detail, definition, req);
          })
        );
      }
      if (body.error.innererror.errordetails.length === 0) {
        body.error.innererror.errordetails.push(singleDetailError);
      }
      body.error.innererror.errordetails.forEach((detail) => {
        if (detail.code && detail.code.toLowerCase().includes("transition")) {
          detail.transition = true;
        }
      });
      delete body.error.details;
    }
    if (typeof body === "object") {
      body = JSON.stringify(body);
    }
    body = `${body}`;
    setContentLength(headers, body);
    return body;
  }

  function convertResponseBody(proxyBody, headers, req) {
    const body = {
      d: {},
    };
    if (req.context.serviceRoot && proxyBody.value) {
      if (req.context.serviceRootAsXML) {
        // Service Root XML
        let xmlBody = `<?xml version="1.0" encoding="utf-8" standalone="yes" ?>`;
        xmlBody += `<service xml:base="${serviceUri(
          req
        )}" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:app="http://www.w3.org/2007/app" xmlns="http://www.w3.org/2007/app">`;
        xmlBody += `<workspace><atom:title>Default</atom:title>`;
        xmlBody += proxyBody.value
          .map((entry) => {
            return `<collection href="${entry.name}"><atom:title>${entry.name}</atom:title></collection>`;
          })
          .join("");
        xmlBody += `</workspace></service>`;
        headers["content-type"] = "application/xml";
        return xmlBody;
      } else {
        // Service Root JSON
        body.d.EntitySets = proxyBody.value.map((entry) => {
          return entry.name;
        });
      }
    } else {
      // Context from Body
      const definition = contextFromBody(proxyBody, req);
      if (definition) {
        req.context.requestDefinition = req.context.definition;
        req.context.definition = definition;
        const definitionElement = contextElementFromBody(proxyBody, req);
        if (definitionElement) {
          body.d[definitionElement.name] = proxyBody.value;
          convertResponseElementData(body, headers, definition, proxyBody, req);
          if (req.context.$value) {
            headers["content-type"] = "text/plain";
            return `${body.d[definitionElement.name]}`;
          }
        } else {
          const data = convertResponseList(body, headers, definition, proxyBody, req);
          convertResponseData(data, headers, definition, proxyBody, req);
        }
      } else {
        // Context from Request
        let definition = req.context.definition;
        if (definition && (definition.kind === "function" || definition.kind === "action")) {
          const returnDefinition = req.context.returnDefinition;
          if (!returnDefinition || returnDefinition.name) {
            definition = returnDefinition;
          } else {
            definition = {
              kind: "type",
              name: contextNameFromBody(proxyBody),
              ...returnDefinition,
            };
          }
          req.context.requestDefinition = req.context.definition;
          req.context.definition = definition;
        }
        const data = convertResponseList(body, headers, definition, proxyBody, req);
        convertResponseData(data, headers, definition, proxyBody, req);
      }
    }

    if (req.context.operation) {
      if (returnComplexNested && req.context.definition.kind === "type" && !Array.isArray(body.d.results)) {
        const localOperationName = localName(req.context.operation.name);
        body.d = {
          [localOperationName]: body.d,
        };
      } else if (
        returnPrimitivePlain &&
        !req.context.definition.kind &&
        req.context.definition.name &&
        req.context.definition.elements.value
      ) {
        if (Array.isArray(body.d.results)) {
          body.d = body.d.results.map((entry) => entry.value);
        } else {
          body.d = body.d.value;
        }
      }
    }

    return JSON.stringify(body);
  }

  function convertResponseList(body, headers, definition, proxyBody, req) {
    if (Array.isArray(proxyBody.value)) {
      if (req.context.aggregationKey) {
        proxyBody = proxyBody.value[0] || {};
      } else {
        body.d.results = proxyBody.value || [];
        if (req.context.$count) {
          body.d.__count = String(proxyBody["@odata.count"] || proxyBody["@count"] || 0);
        }
        if (proxyBody["@odata.nextLink"] !== undefined || proxyBody["@nextLink"] !== undefined) {
          const skipToken = URL.parse(proxyBody["@odata.nextLink"] || proxyBody["@nextLink"], true).query["$skiptoken"];
          if (skipToken) {
            body.d.__next = linkUri(req, {
              $skiptoken: skipToken,
            });
          }
        }
        let deltaToken;
        if (proxyBody["@odata.deltaLink"] !== undefined || proxyBody["@deltaLink"] !== undefined) {
          deltaToken = URL.parse(proxyBody["@odata.deltaLink"] || proxyBody["@deltaLink"], true).query["!deltatoken"];
        }
        if (!deltaToken && definition && definition["@cov2ap.deltaResponse"] === "timestamp") {
          deltaToken = `'${new Date().getTime()}'`;
        }
        if (deltaToken) {
          body.d.__delta = linkUri(req, {
            "!deltatoken": deltaToken,
          });
        }
        body.d.results = body.d.results.map((entry) => {
          return typeof entry == "object" ? entry : { value: entry };
        });
        return body.d.results;
      }
    }
    body.d = proxyBody;
    return [body.d];
  }

  function convertResponseData(data, headers, definition, proxyBody, req) {
    if (data === null) {
      return;
    }
    if (!Array.isArray(data)) {
      return convertResponseData([data], headers, definition, proxyBody, req);
    }
    if (!definition) {
      return;
    }
    // Recursion
    data.forEach((data) => {
      Object.keys(data).forEach((key) => {
        let element = definition.elements && definition.elements[key];
        if (!element) {
          return;
        }
        const type = elementType(element);
        if (type === "cds.Composition" || type === "cds.Association") {
          convertResponseData(data[key], headers, element._target, proxyBody, req);
        }
      });
    });
    // Structural Changes
    data.forEach((data) => {
      addResultsNesting(data, headers, definition, proxyBody, req);
    });
    // Deferreds
    data.forEach((data) => {
      addDeferreds(data, headers, definition, proxyBody, req);
    });
    // Modify Payload
    data.forEach((data) => {
      addMetadata(data, headers, definition, proxyBody, req);
      removeMetadata(data, headers, definition, proxyBody, req);
      convertMedia(data, headers, definition, proxyBody, req);
      removeAnnotations(data, headers, definition, proxyBody, req);
      convertDataTypesToV2(data, headers, definition, proxyBody, req);
      convertAggregation(data, headers, definition, proxyBody, req);
    });
  }

  function convertResponseElementData(data, headers, definition, proxyBody, req) {
    if (!definition) {
      return;
    }
    // Modify Payload
    convertDataTypesToV2(data, headers, definition, proxyBody, req);
  }

  function contextNameFromBody(body) {
    let context = body && (body["@odata.context"] || body["@context"]);
    if (!context) {
      return;
    }
    context = context.substr(context.indexOf("#") + 1);
    if (context.startsWith("Collection(")) {
      context = context.substring("Collection(".length, context.indexOf(")"));
    } else {
      if (context.indexOf("(") !== -1) {
        context = context.substr(0, context.indexOf("("));
      }
    }
    if (context.indexOf("/") !== -1) {
      context = context.substr(0, context.indexOf("/"));
    }
    return context;
  }

  function contextFromBody(body, req) {
    const context = contextNameFromBody(body);
    if (context) {
      return lookupDefinition(context, req);
    }
  }

  function contextElementFromBody(body, req) {
    let context = body["@odata.context"] || body["@context"];
    const definition = contextFromBody(body, req);
    if (!(context && definition)) {
      return null;
    }
    if (context.lastIndexOf("/") !== -1) {
      const name = context.substr(context.lastIndexOf("/") + 1);
      if (name && !name.startsWith("$")) {
        const element = definition.elements && definition.elements[name];
        if (element) {
          return element;
        }
      }
    }
  }

  function addMetadata(data, headers, definition, body, req) {
    data.__metadata = {
      type: definition.name,
    };
    if (definition.kind === "entity") {
      data.__metadata.uri = entityUri(data, definition, req);
      if (data["@odata.etag"] || data["@etag"]) {
        data.__metadata.etag = data["@odata.etag"] || data["@etag"];
      }
      const mediaDataElementName = findElementByAnnotation(definition, "@Core.MediaType");
      if (mediaDataElementName) {
        data.__metadata.media_src = `${data.__metadata.uri}/$value`;
        const mediaDataElement = definition.elements[mediaDataElementName];
        const mediaTypeElementName =
          (mediaDataElement["@Core.MediaType"] && mediaDataElement["@Core.MediaType"]["="]) ||
          findElementByAnnotation(definition, "@Core.IsMediaType");
        if (mediaTypeElementName) {
          data.__metadata.content_type = data[mediaTypeElementName];
        } else if (mediaDataElement["@Core.MediaType"]) {
          data.__metadata.content_type = mediaDataElement["@Core.MediaType"];
        }
        if (!data.__metadata.content_type) {
          data.__metadata.content_type = "application/octet-stream";
        }
      }
    }
  }

  function removeMetadata(data, headers, definition, body, req) {
    Object.keys(data).forEach((key) => {
      if (key.startsWith("@")) {
        delete data[key];
      }
    });
  }

  function convertMedia(data, headers, definition, proxyBody, req) {
    Object.keys(data).forEach((key) => {
      if (key.endsWith("@odata.mediaReadLink")) {
        data[key.split("@odata.mediaReadLink")[0]] = data[key];
      } else if (key.endsWith("@mediaReadLink")) {
        data[key.split("@mediaReadLink")[0]] = data[key];
      }
    });
  }

  function removeAnnotations(data, headers, definition, proxyBody, req) {
    Object.keys(data).forEach((key) => {
      if (key.startsWith("@")) {
        delete data[key];
      }
    });
  }

  function convertAggregation(data, headers, definition, body, req) {
    if (!req.context.$apply) {
      return;
    }
    Object.keys(data).forEach((key) => {
      let value = data[key];
      if (key.startsWith(AggregationPrefix)) {
        if (!(key.endsWith("@odata.type") || key.endsWith("@type"))) {
          const name = key.substr(AggregationPrefix.length);
          let aggregationType = (data[`${key}@odata.type`] || data[`${key}@type`] || "#Decimal").replace("#", "");
          if (DataTypeOData[aggregationType]) {
            aggregationType = DataTypeOData[aggregationType];
          } else {
            aggregationType = `cds.${aggregationType}`;
          }
          if (
            ["cds.Integer", "cds.Integer64", "cds.Double", "cds.Decimal", "cds.DecimalFloat"].includes(aggregationType)
          ) {
            if (value === null || value === "null") {
              value = 0;
            }
          } else if (["cds.String"].includes(aggregationType)) {
            if (value === null) {
              value = "";
            }
          } else if (["cds.Boolean"].includes(aggregationType)) {
            if (value === null) {
              value = false;
            }
          }
          let aggregationValue = convertDataTypeToV2(value, aggregationType, definition);
          // Convert to JSON number
          const element = req.context.$apply.value.find((entry) => {
            return entry.name === name;
          });
          if (element && elementType(element) === "cds.Integer") {
            const aggregation = element["@Aggregation.default"] || element["@DefaultAggregation"];
            const aggregationName = aggregation ? aggregation["#"] || aggregation : DefaultAggregation;
            const aggregationFunction = aggregationName ? AggregationMap[aggregationName.toUpperCase()] : undefined;
            if (
              aggregationType === "cds.Decimal" &&
              aggregationFunction &&
              ![AggregationMap.AVG, AggregationMap.COUNT_DISTINCT].includes(aggregationFunction)
            ) {
              const floatValue = parseFloat(aggregationValue);
              if (aggregationValue === `${floatValue}`) {
                aggregationValue = floatValue;
              }
            }
          }
          data[name] = aggregationValue;
          delete data[key];
        }
      }
    });
    Object.keys(data).forEach((key) => {
      if (key.startsWith(AggregationPrefix) && (key.endsWith("@odata.type") || key.endsWith("@type"))) {
        delete data[key];
      }
    });
    const aggregationKey = {
      key: req.context.$apply.key.reduce((result, keyElement) => {
        const type = elementType(keyElement);
        let value = data[keyElement.name];
        if (value !== undefined && value !== null) {
          value = encodeURIKey(value);
          if (DataTypeMap[type]) {
            value = convertDataTypeToV2Uri(String(value), type).replace(/(.*)/, DataTypeMap[type].v2);
          }
        }
        result[keyElement.name] = value;
        return result;
      }, {}),
      value: req.context.$apply.value.map((valueElement) => {
        return valueElement.name;
      }),
    };
    if (req.context.$apply.filter) {
      aggregationKey.filter = encodeURIComponent(req.context.$apply.filter);
    }
    data.__metadata.uri = entityUriKey(`aggregation'${JSON.stringify(aggregationKey)}'`, definition, req);
    delete data.__metadata.etag;
  }

  function replaceConvertDataTypeToV2(value, type, definition) {
    if (value === null || value === undefined) {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((entry) => {
        return replaceConvertDataTypeToV2(entry, type, definition);
      });
    }
    value = convertDataTypeToV2(value, type, definition);
    if (DataTypeMap[type]) {
      if (!value.match(DataTypeMap[type].v2.replace("$1", ".*"))) {
        value = DataTypeMap[type].v2.replace("$1", value);
      }
    }
    return value;
  }

  function convertDataTypesToV2(data, headers, definition, body, req) {
    Object.keys(data).forEach((key) => {
      if (data[key] === null) {
        return;
      }
      const element = definition.elements && definition.elements[key];
      if (!element) {
        return;
      }
      data[key] = convertDataTypeToV2(data[key], elementType(element), definition);
    });
  }

  function convertDataTypeToV2(value, type, definition) {
    if (value === null || value === undefined) {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((entry) => {
        return convertDataTypeToV2(entry, type, definition);
      });
    }
    if (["cds.Decimal", "cds.DecimalFloat", "cds.Double", "cds.Integer64"].includes(type)) {
      value = `${value}`;
    } else if (!isoDate && !definition["@cov2ap.isoDate"] && ["cds.Date"].includes(type)) {
      value = `/Date(${new Date(value).getTime()})/`;
    } else if (!isoTime && !definition["@cov2ap.isoTime"] && ["cds.Time"].includes(type)) {
      value = convertToDayTimeDuration(value);
    } else if (
      !isoDateTime &&
      !definition["@cov2ap.isoDateTime"] &&
      !isoDateTimeOffset &&
      !definition["@cov2ap.isoDateTimeOffset"] &&
      ["cds.DateTime"].includes(type)
    ) {
      value = `/Date(${new Date(value).getTime()}+0000)/`; // always UTC
    } else if (
      !isoTimestamp &&
      !definition["@cov2ap.isoTimestamp"] &&
      !isoDateTimeOffset &&
      !definition["@cov2ap.isoDateTimeOffset"] &&
      ["cds.Timestamp"].includes(type)
    ) {
      value = `/Date(${new Date(value).getTime()}+0000)/`; // always UTC
    }
    return value;
  }

  function convertDataTypeToV2Uri(value, type) {
    if (["cds.Date"].includes(type)) {
      value = `${value}T00:00`;
    } else if (["cds.Time"].includes(type)) {
      value = convertToDayTimeDuration(value);
    }
    return value;
  }

  function convertToDayTimeDuration(value) {
    const timeParts = value.split(":");
    return `PT${timeParts[0] || "00"}H${timeParts[1] || "00"}M${timeParts[2] || "00"}S`;
  }

  function addResultsNesting(data, headers, definition, root, req) {
    Object.keys(data).forEach((key) => {
      if (!(definition.elements && definition.elements[key])) {
        return;
      }
      if (definition.elements[key].cardinality && definition.elements[key].cardinality.max === "*") {
        data[key] = {
          results: data[key],
        };
      }
    });
  }

  function addDeferreds(data, headers, definition, root, req) {
    if (definition.kind !== "entity" || req.context.$apply) {
      return;
    }
    const _entityUri = entityUri(data, definition, req);
    for (let key of Object.keys(definition.elements || {})) {
      const element = definition.elements[key];
      const type = elementType(element);
      if (element && (type === "cds.Composition" || type === "cds.Association")) {
        if (data[key] === undefined) {
          data[key] = {
            __deferred: {
              uri: `${_entityUri}/${key}`,
            },
          };
        }
      }
    }
  }

  function rootUri(req) {
    const protocol = req.header("x-forwarded-proto") || req.protocol || "http";
    const host =
      req.header("x-forwarded-host") ||
      req.headers.host ||
      `${req.hostname || DefaultHost}:${req.socket.address().port || DefaultPort}`;
    return `${protocol}://${host}`.replace(/^http:\/\/127.0.0.1/, `http://${DefaultHost}`);
  }

  function serviceUri(req) {
    if (req.context.serviceUri) {
      return req.context.serviceUri;
    }
    let serviceUri = rootUri(req);
    if (req.header("x-forwarded-path") === undefined) {
      serviceUri += `${sourcePath}/${req.servicePath}`;
    } else {
      const path = stripSlashes(URL.parse(req.header("x-forwarded-path") || "").pathname || "");
      let resourceStartPath = "";
      const definition = req.context.requestDefinition;
      if (definition) {
        if (definition.kind === "entity") {
          resourceStartPath = localEntityName(definition, req);
        } else if (definition.kind === "function" || definition.kind === "action") {
          resourceStartPath = localEntityName(definition.parent || definition, req);
        }
      }
      const parts = [];
      path.split("/").some((part) => {
        if (
          part === resourceStartPath ||
          part.startsWith(`${resourceStartPath}(`) ||
          part.startsWith(`${resourceStartPath}?`) ||
          part === "$batch" ||
          part.startsWith("$batch?")
        ) {
          return true;
        }
        parts.push(part);
        return false;
      });
      if (parts.length > 0) {
        serviceUri += `/${parts.join("/")}`;
      }
    }
    req.context.serviceUri = serviceUri.endsWith("/") ? serviceUri : `${serviceUri}/`;
    return req.context.serviceUri;
  }

  function entityUriCollection(entity, req) {
    return `${serviceUri(req)}${localEntityName(entity, req)}`;
  }

  function entityUriKey(key, entity, req) {
    return `${entityUriCollection(entity, req)}(${key})`;
  }

  function entityUri(data, entity, req) {
    return entityUriKey(entityKey(data, entity), entity, req);
  }

  function entityKey(data, entity) {
    const keyElements = Object.keys(entity.keys || {}).reduce((keys, key) => {
      const element = entity.elements[key];
      const type = elementType(element);
      if (!(type === "cds.Composition" || type === "cds.Association")) {
        keys.push(element);
      }
      return keys;
    }, []);
    return keyElements
      .map((keyElement) => {
        const type = elementType(keyElement);
        let value = data[keyElement.name];
        if (value !== undefined && value !== null) {
          value = encodeURIKey(value);
          if (DataTypeMap[type]) {
            value = convertDataTypeToV2Uri(String(value), type).replace(/(.*)/, DataTypeMap[type].v2);
          }
        }
        if (keyElements.length === 1) {
          return `${value}`;
        } else {
          return `${keyElement.name}=${value}`;
        }
      })
      .join(",");
  }

  function linkUri(req, params) {
    const originalUrl = req.context.url.originalUrl;
    Object.keys(params || {}).forEach((key) => {
      const value = params[key];
      if (Array.isArray(value)) {
        params[key] = value.pop();
      }
      if (params[key] === undefined) {
        delete params[key];
      }
    });
    return (
      serviceUri(req) +
      decodeURIComponent(
        URL.format({
          ...originalUrl,
          search: null,
          pathname: originalUrl.contextPath,
          query: {
            ...originalUrl.query,
            ...params,
          },
        })
      )
    );
  }

  function respond(req, res, statusCode, headers, body) {
    if (!res.headersSent) {
      if (!body || statusCode === 204) {
        delete headers["content-length"];
      }
      Object.entries(headers).forEach(([name, value]) => {
        res.setHeader(name, value);
      });
      res.status(statusCode);
      if (body && statusCode !== 204) {
        res.write(body);
      }
      res.end();

      // Trace
      traceResponse(req, "Response", res.statusCode, res.statusMessage, headers, body);
    }
  }

  function normalizeContentType(headers) {
    let contentType = headers["content-type"];
    if (contentType) {
      contentType = contentType.trim();
      if (isApplicationJSON(contentType)) {
        contentType = contentType
          .split(";")
          .filter((part) => {
            return !part.startsWith("odata.");
          })
          .join(";");
      }
      headers["content-type"] = contentType;
    }
    return contentType;
  }

  function fillLoggingHeaders(req, headers) {
    if (req.loggingContext) {
      headers["x-request-id"] = req.loggingContext.id;
      headers["x-correlationid"] = req.loggingContext.correlationId;
    }
    return headers;
  }

  function enrichApplicationJSON(contentType) {
    const [key] = IEEE754Compatible.split("=");
    if (!contentType.includes(key)) {
      contentType += ";" + IEEE754Compatible;
    }
    return contentType;
  }

  function isApplicationJSON(contentType) {
    return contentType && contentType.startsWith("application/json");
  }

  function isPlainText(contentType) {
    return contentType && contentType.startsWith("text/plain");
  }

  function isXML(contentType) {
    return (
      contentType &&
      (contentType.startsWith("application/xml") ||
        contentType.startsWith("application/atomsvc+xml") ||
        contentType.startsWith("text/xml") ||
        contentType.startsWith("text/html"))
    );
  }

  function isMultipartMixed(contentType) {
    return contentType && contentType.replace(/\s/g, "").startsWith("multipart/mixed;boundary=");
  }

  function isMultipartFormData(contentType) {
    return contentType && contentType.replace(/\s/g, "").startsWith("multipart/form-data;boundary=");
  }

  function encodeURIKey(value) {
    return encodeURIComponent(value).replace(/[/]/g, "%2F").replace(/'/g, "''").replace(/%3A/g, ":");
  }

  function decodeURIKey(value) {
    return decodeURIComponent(value).replace(/%2F/g, "/");
  }

  function targetUrl(req) {
    // Non-batch scenario only
    let path = req.originalUrl;
    Object.entries(pathRewrite).forEach(([key, value]) => {
      path = path.replace(new RegExp(key, "g"), value);
    });
    return path;
  }

  function lookupReturnDefinition(returns, req) {
    returns = (returns && returns.items) || returns;
    if (returns && returns.type) {
      const definition = lookupDefinition(returns.type, req);
      return definition || lookupReturnPrimitiveDefinition(returns);
    }
    return returns;
  }

  function lookupReturnPrimitiveDefinition(returns) {
    returns = (returns && returns.items) || returns;
    const type =
      returns &&
      returns.type &&
      Object.keys(DataTypeOData).find((key) => {
        return DataTypeOData[key] === returns.type;
      });
    return {
      name: type,
      elements: {
        value: returns,
      },
    };
  }

  function elementType(element) {
    let type;
    if (element) {
      type = element.type;
      if (element["@odata.Type"]) {
        const odataType = localName(element["@odata.Type"]);
        if (odataType && DataTypeOData[odataType]) {
          type = DataTypeOData[odataType];
        }
      }
      if (!type && element.items && element.items.type) {
        type = element.items.type;
      }
    }
    return type;
  }

  function findElementByAnnotation(definition, annotation) {
    return (
      definition &&
      definition.elements &&
      Object.keys(definition.elements)
        .filter((key) => {
          return !(
            definition.elements[key].type === "cds.Composition" && definition.elements[key].type === "cds.Association"
          );
        })
        .find((key) => {
          const element = definition.elements[key];
          return element && !!element[annotation];
        })
    );
  }

  function findElementValueByAnnotation(definition, annotation) {
    const elementName = findElementByAnnotation(definition, annotation);
    if (elementName) {
      const elementValue = definition.elements[elementName][annotation];
      if (elementValue) {
        return elementValue["="] || elementValue;
      }
    }
    return undefined;
  }

  function findEndingElementName(definition, url) {
    return (
      definition &&
      definition.elements &&
      Object.keys(definition.elements)
        .filter((key) => {
          return !(
            definition.elements[key].type === "cds.Composition" && definition.elements[key].type === "cds.Association"
          );
        })
        .find((key) => {
          const element = definition.elements[key];
          return url.contextPath.endsWith(`/${element.name}`);
        })
    );
  }

  function determineLocale(req) {
    let locale;
    if (cds.User) {
      const user = new cds.User();
      user._req = req;
      locale = user.locale;
    } else {
      locale = require("@sap/cds-runtime/lib/cds-services/adapter/utils/locale")({ req });
    }
    if (locale && locale.length >= 2) {
      locale = locale.substr(0, 2).toLowerCase() + locale.slice(2);
    }
    return locale;
  }

  function decodeBase64(b64String) {
    return Buffer.from(b64String, "base64").toString();
  }

  function decodeJwtTokenBody(token) {
    return JSON.parse(decodeBase64(token.split(".")[1]));
  }

  function setContentLength(headers, body) {
    if (body && !(headers["transfer-encoding"] || "").includes("chunked")) {
      headers["content-length"] = Buffer.byteLength(body);
    } else {
      delete headers["content-length"];
    }
  }

  function processMultipartMixed(
    req,
    multiPartBody,
    contentType,
    urlProcessor,
    bodyHeadersProcessor,
    contentIdOrder = [],
    direction
  ) {
    let maxContentId = 1;

    function nextContentID() {
      return "cov2ap_" + String(maxContentId++);
    }

    const match = contentType.replace(/\s/g, "").match(/^multipart\/mixed;boundary=(.*)$/i);
    let boundary = match && match.pop();
    if (!boundary) {
      return multiPartBody;
    }
    let boundaryChangeSet = "";
    let urlAfterBlank = false;
    let bodyAfterBlank = false;
    let previousLineIsBlank = false;
    let index = 0;
    let statusCode;
    let contentId;
    let contentIdMisplaced = false;
    let contentTransferEncoding;
    let body = "";
    let headers = {};
    let method = "";
    let url = "";
    const parts = multiPartBody.split("\r\n");
    const newParts = [];
    parts.forEach((part) => {
      const match = part.replace(/\s/g, "").match(/^content-type:multipart\/mixed;boundary=(.*)$/i);
      if (match) {
        boundaryChangeSet = match.pop();
      }
      if (part.startsWith(`--${boundary}`) || (boundaryChangeSet && part.startsWith(`--${boundaryChangeSet}`))) {
        // Body & Headers
        if (bodyAfterBlank) {
          if (bodyHeadersProcessor) {
            try {
              const contentType = normalizeContentType(headers);
              if (isApplicationJSON(contentType)) {
                body = (body && JSON.parse(body)) || {};
              }
              const result = bodyHeadersProcessor({
                index,
                statusCode,
                contentType,
                body,
                headers,
                method,
                url,
                contentId,
              });
              body = (result && result.body) || body;
              headers = (result && result.headers) || headers;
            } catch (err) {
              // Error
              logError(req, "Batch", err);
            }
          }
          if (boundaryChangeSet) {
            // Inject mandatory content-id for changesets
            const addContentIdHeader = contentId === undefined || contentIdMisplaced;
            if (contentId === undefined && direction === ProcessingDirection.Request) {
              contentId = nextContentID();
            }
            if (contentId !== undefined) {
              if (direction === ProcessingDirection.Request || !contentId.startsWith("cov2ap_")) {
                if (addContentIdHeader) {
                  // Add content-id to headers of changeset (before url = -3)
                  newParts.splice(-3, 0, `content-id: ${contentId}`);
                }
                headers["content-id"] = contentId;
              }
              contentIdOrder.push(contentId);
            }
          }
          // Inject mandatory content-transfer-encoding
          if (!contentTransferEncoding) {
            contentTransferEncoding = "binary";
            // Add content-transfer-encoding to headers (before url = -3)
            newParts.splice(-3, 0, `content-transfer-encoding: ${contentTransferEncoding}`);
          }
          Object.entries(headers).forEach(([name, value]) => {
            newParts.splice(-1, 0, `${name}: ${value}`);
          });
          newParts.push(body);
          statusCode = undefined;
          contentId = undefined;
          contentIdMisplaced = false;
          contentTransferEncoding = undefined;
          body = "";
          headers = {};
          url = "";
          index++;
        }
        urlAfterBlank = true;
        bodyAfterBlank = false;
        newParts.push(part);
        if (boundaryChangeSet && part === `--${boundaryChangeSet}--`) {
          boundaryChangeSet = "";
        }
      } else if (urlAfterBlank && previousLineIsBlank) {
        urlAfterBlank = false;
        bodyAfterBlank = true;
        // Url
        const urlParts = part.split(" ");
        let partMethod = urlParts[0];
        let partUrl = urlParts.slice(1, -1).join(" ");
        let partProtocol = urlParts.pop();
        if (urlProcessor) {
          const result = urlProcessor({ method: partMethod, url: partUrl });
          if (result) {
            partMethod = result.method;
            partUrl = result.url;
            part = [partMethod, partUrl, partProtocol].join(" ");
          }
        }
        method = partMethod;
        url = partUrl;

        newParts.push(part);
        if (part.startsWith("HTTP/")) {
          const statusCodeMatch = part.match(/^HTTP\/[\d.]+\s+(\d{3})\s.*$/i);
          if (statusCodeMatch) {
            statusCode = parseInt(statusCodeMatch.pop());
          }
        }
      } else if (bodyAfterBlank && (previousLineIsBlank || body !== "")) {
        body = body ? `${body}\r\n${part}` : part;
      } else if (part !== "") {
        const partIsContentId = part.toLowerCase().startsWith("content-id:");
        if (partIsContentId) {
          const colonIndex = part.indexOf(":");
          if (colonIndex !== -1) {
            contentId = part.substr(colonIndex + 1).trim();
            contentIdMisplaced = !!bodyAfterBlank;
          }
        }
        const partContentTransferEncoding = part.toLowerCase().startsWith("content-transfer-encoding:");
        if (partContentTransferEncoding && !bodyAfterBlank) {
          const colonIndex = part.indexOf(":");
          if (colonIndex !== -1) {
            contentTransferEncoding = part.substr(colonIndex + 1).trim();
          }
        }
        if (!bodyAfterBlank) {
          if (!(direction === ProcessingDirection.Response && partIsContentId && contentId.startsWith("cov2ap_"))) {
            newParts.push(part);
          }
        } else {
          let colonIndex = part.indexOf(":");
          if (colonIndex !== -1) {
            headers[part.substr(0, colonIndex).toLowerCase()] = part.substr(colonIndex + 1).trim();
          }
        }
      } else {
        newParts.push(part);
      }
      previousLineIsBlank = part === "";
    });
    return newParts.join("\r\n");
  }

  function traceRequest(req, name, method, url, headers, body) {
    if (!req.loggingContext.getTracer(name).isEnabled("debug")) {
      return;
    }
    const _url = url || "";
    const _headers = JSON.stringify(headers || {});
    const _body = typeof body === "string" ? body : body ? JSON.stringify(body) : "";
    trace(req, name, `${method} ${_url}`, _headers && "Headers:", _headers, _body && "Body:", _body);
  }

  function traceResponse(req, name, statusCode, statusMessage, headers, body) {
    if (!req.loggingContext.getTracer(name).isEnabled("debug")) {
      return;
    }
    const _headers = JSON.stringify(headers || {});
    const _body = typeof body === "string" ? body : body ? JSON.stringify(body) : "";
    trace(
      req,
      name,
      `${statusCode || ""} ${statusMessage || ""}`,
      _headers && "Headers:",
      _headers,
      _body && "Body:",
      _body
    );
  }

  function trace(req, name, ...messages) {
    const message = messages.filter((message) => !!message).join("\n");
    req.loggingContext.getTracer(`cov2ap/${name}`).debug(message);
  }

  function logError(req, name, error) {
    req.loggingContext.getLogger(`/cov2ap/${name}`).error(error);
  }

  function logWarning(req, name, message, info) {
    req.loggingContext.getLogger(`/cov2ap/${name}`).warning(`${message}: ${JSON.stringify(info)}`);
  }

  return router;
}

module.exports = cov2ap;
