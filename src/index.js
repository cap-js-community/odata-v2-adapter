"use strict";

// OData V2/V4 Delta: http://docs.oasis-open.org/odata/new-in-odata/v4.0/cn01/new-in-odata-v4.0-cn01.html
const os = require("os");
const fs = require("fs");
const fsPath = require("path");
const URL = require("url");
const { pipeline } = require("stream");
const express = require("express");
const expressFileUpload = require("express-fileupload");
const cds = require("@sap/cds");
const { promisify } = require("util");
const { createProxyMiddleware } = require("http-proxy-middleware");
const bodyParser = require("body-parser");
require("body-parser-xml")(bodyParser);
const xml2js = require("xml2js");
const xmlParser = new xml2js.Parser({
  async: false,
  tagNameProcessors: [xml2js.processors.stripPrefix],
});
const cacheSymbol = Symbol("cov2ap");

const CACHE_DIR = fs.realpathSync(os.tmpdir());

// Suppress deprecation warning in Node 22 due to http-proxy using util._extend()
require("util")._extend = Object.assign;

const SeverityMap = {
  1: "success",
  2: "info",
  3: "warning",
  4: "error",
};

// Support HANA's SYSUUID, which does not conform to real UUID formats
const UUIDLikeRegex = /guid'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'/gi;
// https://www.w3.org/TR/xmlschema11-2/#nt-duDTFrag
const DurationRegex =
  /^P(?:(\d)Y)?(?:(\d{1,2})M)?(?:(\d{1,2})D)?T(?:(\d{1,2})H)?(?:(\d{2})M)?(?:(\d{2}(?:\.\d+)?)S)?$/i;
// Unsupported Draft Filter
const UnsupportedDraftFilterRegex =
  /\(IsActiveEntity eq true and (.*?)\) or \(IsActiveEntity eq false and \((.*?) or HasActiveEntity eq false\)\)/;

// https://cap.cloud.sap/docs/cds/types
const DataTypeMap = {
  "cds.UUID": { v2: `guid'$1'`, v4: UUIDLikeRegex },
  // "cds.Boolean" - no transformation
  // "cds.Integer" - no transformation
  "cds.Integer64": { v2: `$1L`, v4: /([-]?[0-9]+?)L/gi },
  "cds.Decimal": { v2: `$1m`, v4: /([-]?[0-9]+?\.?[0-9]*)m/gi },
  "cds.DecimalFloat": { v2: `$1f`, v4: /([-]?[0-9]+?\.?[0-9]*)f/gi },
  "cds.Double": { v2: `$1d`, v4: /([-]?[0-9]+?\.?[0-9]*(?:E[+-]?[0-9]+?)?)d/gi },
  "cds.Date": { v2: `datetime'$1'`, v4: /datetime'(.+?)'/gi },
  "cds.Time": { v2: `time'$1'`, v4: /time'(.+?)'/gi },
  "cds.DateTime": { v2: `datetimeoffset'$1'`, v4: /datetime(?:offset)?'(.+?)'/gi },
  "cds.Timestamp": { v2: `datetimeoffset'$1'`, v4: /datetime(?:offset)?'(.+?)'/gi },
  "cds.String": { v2: `'$1'`, v4: /(.*)/gis },
  "cds.Binary": { v2: `binary'$1'`, v4: /X'(?:[0-9a-f][0-9a-f])+?'/gi },
  "cds.LargeBinary": { v2: `binary'$1'`, v4: /X'(?:[0-9a-f][0-9a-f])+?'/gi },
  "cds.LargeString": { v2: `'$1'`, v4: /(.*)/gis },
};

// https://www.odata.org/documentation/odata-version-2-0/overview/ (6. Primitive Data Types)
// https://cap.cloud.sap/docs/advanced/odata#type-mapping
const DataTypeOData = {
  Binary: "cds.Binary",
  Boolean: "cds.Boolean",
  Byte: "cds.UInt8",
  DateTime: "cds.DateTime",
  Decimal: "cds.Decimal",
  Double: "cds.Double",
  Single: "cds.Double",
  Guid: "cds.UUID",
  Int16: "cds.Int16",
  Int32: "cds.Integer",
  Int64: "cds.Integer64",
  SByte: "cds.Integer",
  String: "cds.String",
  Time: "cds.Time",
  DateTimeOffset: "cds.Timestamp",
  Date: "cds.Date",
  TimeOfDay: "cds.Time",
  _Decimal: "cds.DecimalFloat",
  _Binary: "cds.LargeBinary",
  _String: "cds.LargeString",
};

// https://cap.cloud.sap/docs/advanced/odata#type-mapping
const ODataType = {
  "cds.UUID": "Edm.Guid",
  "cds.Boolean": "Edm.Boolean",
  "cds.UInt8": "Edm.Byte",
  "cds.Int16": "Edm.Int16",
  "cds.Int32": "Edm.Int32",
  "cds.Integer": "Edm.Int32",
  "cds.Int64": "Edm.Int64",
  "cds.Integer64": "Edm.Int64",
  "cds.Decimal": "Edm.Decimal",
  "cds.Double": "Edm.Double",
  "cds.Date": "Edm.DateTime",
  "cds.Time": "Edm.Time",
  "cds.DateTime": "Edm.DateTime",
  "cds.Timestamp": "Edm.DateTimeOffset",
  "cds.String": "Edm.String",
  "cds.Binary": "Edm.Binary",
  "cds.LargeBinary": "Edm.Binary",
  "cds.LargeString": "Edm.String",
};

const AggregationMap = {
  SUM: "sum",
  MIN: "min",
  MAX: "max",
  AVG: "average",
  COUNT: "$count",
  COUNT_DISTINCT: "countdistinct",
  NONE: "none",
  NOP: "nop",
};

const DefaultAggregation = AggregationMap.SUM;

const FilterFunctions = {
  "substringof($,$)": "contains($2,$1)",
  "gettotaloffsetminutes($)": "totaloffsetminutes($1)",
};

const FilterFunctionsCaseInsensitive = {
  "substringof($,$)": "contains(tolower($2),tolower($1))",
  "startswith($,$)": "startswith(tolower($1),tolower($2))",
  "endswith($,$)": "endswith(tolower($1),tolower($2))",
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
const MessageTargetTransient = "/#TRANSIENT#";
const MessageTargetTransientPrefix = `${MessageTargetTransient}/`;

function convertToNodeHeaders(webHeaders) {
  return Array.from(webHeaders.entries()).reduce((result, [key, value]) => {
    result[key] = value;
    return result;
  }, {});
}

/**
 * Instantiates a OData V2 adapter for CDS Express Router for a CDS-based OData V4 Server:
 * @param {object} options OData V2 adapter for CDS options object.
 * @param {string} options.base Base path under which the service is reachable. Default is ''.
 * @param {string} options.path Path under which the service is reachable. Default is `'odata/v2'`. Default path is `'v2'` for CDS <7 or `middlewares` deactivated.
 * @param {string|string[]|object} options.model CDS service model (path(s) or CSN). Default is 'all'.
 * @param {number} options.port Target port which points to OData V4 backend port. Default is process.env.PORT or 4004.
 * @param {string} options.target Target which points to OData V4 backend host:port. Use 'auto' to infer the target from server url after listening. Default is e.g. 'auto'.
 * @param {string} options.targetPath Target path to which is redirected. Default is `'odata/v4'`. Default path is `''` for CDS <7 or `middlewares` deactivated.
 * @param {object} options.services Service mapping object from url path name to service name. Default is {}.
 * @param {boolean} options.mtxRemote CDS model is retrieved remotely via MTX endpoint for multitenant scenario (old MTX only). Default is false.
 * @param {string} options.mtxEndpoint Endpoint to retrieve MTX metadata when option 'mtxRemote' is active (old MTX only). Default is '/mtx/v1'.
 * @param {boolean} options.ieee754Compatible Edm.Decimal and Edm.Int64 are serialized IEEE754 compatible. Default is true.
 * @param {number} options.fileUploadSizeLimit File upload file size limit (in bytes) for multipart/form-data . Default is 10485760 (10 MB).
 * @param {boolean} options.continueOnError Indicates to OData V4 backend to continue on error. Default is false.
 * @param {boolean} options.isoTime Use ISO 8601 format for type cds.Time (Edm.Time). Default is false.
 * @param {boolean} options.isoDate Use ISO 8601 format for type cds.Date (Edm.DateTime). Default is false.
 * @param {boolean} options.isoDateTime Use ISO 8601 format for type cds.DateTime (Edm.DateTimeOffset). Default is false.
 * @param {boolean} options.isoTimestamp Use ISO 8601 format for type cds.Timestamp (Edm.DateTimeOffset). Default is false.
 * @param {boolean} options.isoDateTimeOffset Use ISO 8601 format for type Edm.DateTimeOffset (cds.DateTime, cds.Timestamp). Default is false.
 * @param {string} options.bodyParserLimit Request and response body parser size limit. Default is '100mb'.
 * @param {boolean} options.returnCollectionNested Collection of entity type is returned nested into a results section. Default is true.
 * @param {boolean} options.returnComplexNested Function import return structure of complex type (non collection) is nested using function import name. Default is true.
 * @param {boolean} options.returnPrimitiveNested Function import return structure of primitive type (non collection) is nested using function import name. Default is true.
 * @param {boolean} options.returnPrimitivePlain Function import return value of primitive type is rendered as plain JSON value. Default is true.
 * @param {string} options.messageTargetDefault Specifies the message target default, if target is undefined. Default is '/#TRANSIENT#'.
 * @param {boolean} options.caseInsensitive Transforms search functions i.e. substringof, startswith, endswith to case-insensitive variant. Default is false.
 * @param {boolean} options.propagateMessageToDetails Propagates root error or message always to details section. Default is false.
 * @param {boolean} options.contentDisposition Default content disposition for media streams (inline, attachment), if not available or calculated. Default is 'attachment'.
 * @param {boolean} options.calcContentDisposition Calculate content disposition for media streams even if already available. Default is false.
 * @param {boolean} options.quoteSearch Specifies if search expression is quoted automatically. Default is true.
 * @param {boolean} options.fixDraftRequests Specifies if unsupported draft requests are converted to a working version. Default is false.
 * @param {string} options.changesetDeviationLogLevel Log level of batch changeset content-id deviation logs (none, debug, info, warn, error). Default is 'info'.
 * @param {string} options.defaultFormat Specifies the default entity response format (json, atom). Default is 'json'.
 * @param {boolean} options.processForwardedHeaders Specifies if 'x-forwarded' headers are processed. Default is 'true'.
 * @param {boolean} options.cacheDefinitions Specifies if the definition elements are cached. Default is 'true'.
 * @param {string} options.cacheMetadata Specifies the caching and provisioning strategy of metadata (e.g. edmx) (memory, disk, stream). Default is 'memory'.
 * @returns {express.Router} OData V2 adapter for CDS Express Router
 */
function cov2ap(options = {}) {
  if (cov2ap._singleton) {
    return cov2ap._singleton;
  }
  const router = express.Router();
  const optionWithFallback = (name, fallback) => {
    if (options && Object.prototype.hasOwnProperty.call(options, name)) {
      return options[name];
    }
    if (cds.env.cov2ap && Object.prototype.hasOwnProperty.call(cds.env.cov2ap, name)) {
      return cds.env.cov2ap[name];
    }
    const scName = name.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
    if (cds.env.cov2ap && Object.prototype.hasOwnProperty.call(cds.env.cov2ap, scName)) {
      return cds.env.cov2ap[scName];
    }
    const acName = name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
    if (cds.env.cov2ap && Object.prototype.hasOwnProperty.call(cds.env.cov2ap, acName)) {
      return cds.env.cov2ap[acName]["undefined"];
    }
    return fallback;
  };

  let oDataV2Path = "v2";
  let oDataV4Path = "";
  const oDataProtocolPrefixActive = parseInt(cds.version, 10) >= 7 && cds.env.requires.middlewares;
  if (oDataProtocolPrefixActive) {
    oDataV2Path = "odata/v2";
    oDataV4Path = "odata/v4";
    if (cds.env.protocols) {
      if (cds.env.protocols["odata-v2"]) {
        oDataV2Path = cds.env.protocols["odata-v2"].path;
      }
      if (cds.env.protocols.odata) {
        oDataV4Path = cds.env.protocols.odata.path;
      } else if (cds.env.protocols["odata-v4"]) {
        oDataV4Path = cds.env.protocols["odata-v4"].path;
      }
    }
  }
  const oDataV2RelativePath = oDataV2Path.replace(/^\//, "");
  const oDataV4RelativePath = oDataV4Path.replace(/^\//, "");

  const metadataCache = {};
  const base = optionWithFallback("base", "");
  const path = optionWithFallback("path", oDataV2RelativePath);
  const sourcePath = `${base ? "/" + base : ""}/${path}`;
  const targetPath = optionWithFallback("targetPath", oDataV4RelativePath);
  const rewritePath = `${base ? "/" + base : ""}${targetPath ? "/" : ""}${targetPath}`;
  let port = optionWithFallback("port", process.env.PORT || DefaultPort);
  const defaultTarget = `http://${DefaultHost}:${port}`;
  let target = optionWithFallback("target", "auto");
  const services = optionWithFallback("services", {});
  const mtxRemote = optionWithFallback("mtxRemote", false);
  const mtxEndpoint = optionWithFallback("mtxEndpoint", "/mtx/v1");
  const ieee754Compatible = optionWithFallback("ieee754Compatible", true);
  const fileUploadSizeLimit = optionWithFallback("fileUploadSizeLimit", 10 * 1024 * 1024);
  const continueOnError = optionWithFallback("continueOnError", false);
  const isoTime = optionWithFallback("isoTime", false);
  const isoDate = optionWithFallback("isoDate", false);
  const isoDateTime = optionWithFallback("isoDateTime", false);
  const isoTimestamp = optionWithFallback("isoTimestamp", false);
  const isoDateTimeOffset = optionWithFallback("isoDateTimeOffset", false);
  const bodyParserLimit = optionWithFallback("bodyParserLimit", "100mb");
  const returnCollectionNested = optionWithFallback("returnCollectionNested", true);
  const returnComplexNested = optionWithFallback("returnComplexNested", true);
  const returnPrimitiveNested = optionWithFallback("returnPrimitiveNested", true);
  const returnPrimitivePlain = optionWithFallback("returnPrimitivePlain", true);
  const messageTargetDefault = optionWithFallback("messageTargetDefault", MessageTargetTransient);
  const caseInsensitive = optionWithFallback("caseInsensitive", false);
  const propagateMessageToDetails = optionWithFallback("propagateMessageToDetails", false);
  const contentDisposition = optionWithFallback("contentDisposition", "attachment");
  const calcContentDisposition = optionWithFallback("calcContentDisposition", false);
  const quoteSearch = optionWithFallback("quoteSearch", true);
  const fixDraftRequests = optionWithFallback("fixDraftRequests", false);
  const changesetDeviationLogLevel = optionWithFallback("changesetDeviationLogLevel", "info");
  const defaultFormat = optionWithFallback("defaultFormat", "json");
  const processForwardedHeaders = optionWithFallback("processForwardedHeaders", true);
  const cacheDefinitions = optionWithFallback("cacheDefinitions", true);
  const cacheMetadata = optionWithFallback("cacheMetadata", "memory");

  if (cds.env.protocols) {
    cds.env.protocols["odata-v2"] = {
      path: sourcePath,
      impl: __filename,
    };
  }

  if (caseInsensitive) {
    Object.assign(FilterFunctions, FilterFunctionsCaseInsensitive);
  }

  const fileUpload = expressFileUpload({
    abortOnLimit: true,
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

  async function clearMetadataCache(tenant) {
    if (metadataCache[tenant]) {
      const tenantCache = metadataCache[tenant];
      delete metadataCache[tenant];
      if (cacheDefinitions) {
        const csn = await callCached(tenantCache, "csn");
        if (csn) {
          for (const name in csn.definitions) {
            const definition = csn.definitions[name];
            delete definition[cacheSymbol];
          }
        }
      }
    }
  }

  cds.on("serving", (service) => {
    const isOData = isServedViaOData(service);
    if (!isOData) {
      return;
    }

    const odataV2Path = serviceODataV2Path(service);
    const odataV4Path = serviceODataV4Path(service);
    const protocolPath = `${sourcePath}${sourceServicePath(odataV4Path)}`;
    let endpointPath = protocolPath;

    // Protocol re-routing
    if (odataV2Path && protocolPath !== odataV2Path) {
      endpointPath = endpointPath.replace(protocolPath, odataV2Path);
      router.all([`${odataV2Path}`, `${odataV2Path}/*`], (req, res, next) => {
        req.url = req.url.replace(odataV2Path, protocolPath);
        req.originalUrl = req.url;
        req.endpointRewrite = (url) => {
          return url.replace(protocolPath, odataV2Path);
        };
        next();
      });
    }

    const provider = (entity, endpoint) => {
      if (endpoint && !endpoint.kind.startsWith("odata")) {
        return;
      }
      const href = `${endpointPath}/${entity || "$metadata"}`;
      return { href, name: `${entity || "$metadata"} (V2)`, title: "OData V2" };
    };
    service.$linkProviders = service.$linkProviders || [];
    service.$linkProviders.push(provider);
  });

  if (cds.mtx && cds.mtx.eventEmitter) {
    cds.mtx.eventEmitter.on(cds.mtx.events.TENANT_UPDATED, async (tenant) => {
      try {
        await clearMetadataCache(tenant);
      } catch (err) {
        logError({ tenant }, "Cache", err);
      }
    });
  }
  cds.on("cds.xt.TENANT_UPDATED", async ({ tenant }) => {
    try {
      await clearMetadataCache(tenant);
    } catch (err) {
      logError({ tenant }, "Cache", err);
    }
  });

  async function routeInitRequest(req, res, next) {
    req.now = new Date();
    req.contextId =
      req.headers["x-correlation-id"] ||
      req.headers["x-correlationid"] ||
      req.headers["x-request-id"] ||
      req.headers["x-vcap-request-id"] ||
      cds.utils.uuid();
    res.set("x-request-id", req.contextId);
    res.set("x-correlation-id", req.contextId);
    res.set("x-correlationid", req.contextId);
    try {
      const [authType, token] = (req.headers.authorization && req.headers.authorization.split(" ")) || [];
      if (authType && token) {
        let jwtBody;
        switch (authType) {
          case "Basic":
            req.user = {
              id: decodeBase64(token).split(":")[0],
            };
            if (req.user.id && cds.env.requires.auth && ["basic", "mocked"].includes(cds.env.requires.auth.kind)) {
              const user = (cds.env.requires.auth.users || {})[req.user.id];
              req.tenant = user && (user.tenant || (user.jwt && user.jwt.zid));
            }
            break;
          case "Bearer":
            jwtBody = decodeJwtTokenBody(token);
            req.user = {
              id: jwtBody.user_name || jwtBody.client_id,
            };
            req.tenant = jwtBody.zid;
            if (!req.authInfo) {
              req.authInfo = {
                getSubdomain: () => {
                  return jwtBody.ext_attr && jwtBody.ext_attr.zdn;
                },
              };
            }
            break;
        }
      }
    } catch (err) {
      logError(req, "Authorization", err);
    }
    next();
  }

  async function routeGetMetadata(req, res) {
    let serviceValid = true;
    try {
      const urlPath = targetUrl(req.originalUrl);
      const metadataUrl = URL.parse(urlPath, true);
      let metadataPath = metadataUrl.pathname.substring(0, metadataUrl.pathname.length - 9);

      const { csn } = await getMetadata(req);
      req.csn = csn;
      const service = serviceFromRequest(req);

      if (service.absolute && metadataPath.startsWith(`/${targetPath}`)) {
        metadataPath = metadataPath.substring(targetPath.length + 1);
      }
      const serviceUrl = target + metadataPath;

      // Trace
      traceRequest(req, "Request", req.method, req.originalUrl, req.headers, req.body);
      traceRequest(req, "ProxyRequest", req.method, metadataPath, req.headers, req.body);

      const result = await Promise.all([
        fetch(serviceUrl, {
          method: "GET",
          headers: {
            ...propagateHeaders(req),
            accept: "application/json",
          },
        }),
        (async () => {
          if (service && service.name) {
            serviceValid = service.valid;
            const { edmx } = await getMetadata(req, service.name);
            return edmx;
          }
        })(),
      ]);
      const [metadataResponse, edmx] = result;
      const metadataBody = await metadataResponse.text();
      const headers = convertBasicHeaders(convertToNodeHeaders(metadataResponse.headers));
      headers["content-type"] = "application/xml";
      delete headers["content-encoding"];
      let body;
      if (metadataResponse.ok || metadataResponse.status === 304) {
        if (cacheMetadata === "disk") {
          body = await fs.promises.readFile(edmx, "utf8");
        } else if (cacheMetadata === "stream") {
          body = fs.createReadStream(edmx);
        } else {
          body = edmx;
        }
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
        metadataBody,
      );

      respond(req, res, metadataResponse.status, headers, body);
    } catch (err) {
      if (serviceValid) {
        // Error
        if (err.statusCode === 400) {
          logWarn(req, "MetadataRequest", err);
        } else {
          logError(req, "MetadataRequest", err);
        }
        // Trace
        logWarn(req, "MetadataRequest", "Request with Error", {
          method: req.method,
          url: req.originalUrl,
          target,
        });
        if (err.statusCode) {
          res.status(err.statusCode).send(err.message);
        } else {
          res.status(500).send("Internal Server Error");
        }
      } else {
        res.status(404).send("Not Found");
      }
    }
  }

  async function routeBodyParser(req, res, next) {
    const contentType = req.header("content-type");
    if (!contentType) {
      return next();
    }

    if (isApplicationJSON(contentType)) {
      express.json({ limit: bodyParserLimit })(req, res, next);
    } else if (isXML(contentType)) {
      bodyParser.xml({
        limit: bodyParserLimit,
        xmlParseOptions: {
          tagNameProcessors: [xml2js.processors.stripPrefix],
        },
      })(req, res, next);
    } else if (isMultipartMixed(contentType)) {
      express.text({ type: "multipart/mixed", limit: bodyParserLimit })(req, res, next);
    } else {
      req.checkUploadBinary = req.method === "POST";
      next();
    }
  }

  async function routeSetContext(req, res, next) {
    try {
      const { csn } = await getMetadata(req);
      req.csn = csn;
    } catch (err) {
      // Error
      logError(req, "Request", err);
      res.status(500).send("Internal Server Error");
      return;
    }
    try {
      const service = serviceFromRequest(req);
      req.base = base;
      req.service = service.name;
      req.servicePath = service.path;
      req.serviceAbsolute = service.absolute;
      req.context = {};
      req.contexts = [];
      req.contentId = {};
      req.lookupContext = {};
      next();
    } catch (err) {
      // Error
      if (err.statusCode === 400) {
        logWarn(req, "Request", err);
      } else {
        logError(req, "Request", err);
      }
      // Trace
      logWarn(req, "Request", "Request with Error", {
        method: req.method,
        url: req.originalUrl,
        target,
      });
      if (err.statusCode) {
        res.status(err.statusCode).send(err.message);
      } else {
        res.status(500).send("Internal Server Error");
      }
    }
  }

  async function routeFileUpload(req, res, next) {
    if (!req.checkUploadBinary) {
      return next();
    }

    const urlPath = targetUrl(req.originalUrl);
    const url = parseUrl(urlPath, req);
    const definition = contextFromUrl(url, req);
    if (!definition) {
      return next();
    }
    convertUrl(url, req);
    const elements = definitionElements(definition);
    const mediaDataElementName =
      findElementByAnnotation(elements, "@Core.MediaType") ||
      findElementByType(elements, DataTypeOData._Binary, req) ||
      findElementByType(elements, DataTypeOData.Binary, req);
    if (!mediaDataElementName) {
      return next();
    }

    const handleMediaEntity = async (contentType, filename, headers = {}) => {
      try {
        contentType = contentType || "application/octet-stream";
        const body = {};
        // Custom body
        const caseInsensitiveElements = Object.keys(elements).reduce((result, name) => {
          result[name.toLowerCase()] = elements[name];
          return result;
        }, {});
        Object.keys(headers).forEach((name) => {
          const element = caseInsensitiveElements[name.toLowerCase()];
          if (element) {
            const value = convertDataTypeToV4(headers[name], elementType(element, req), definition, headers);
            body[element.name] = decodeHeaderValue(definition, element, element.name, value);
          }
        });
        const mediaDataElement = elements[mediaDataElementName];
        const mediaTypeElementName =
          (mediaDataElement["@Core.MediaType"] && mediaDataElement["@Core.MediaType"]["="]) ||
          findElementByAnnotation(elements, "@Core.IsMediaType");
        if (mediaTypeElementName) {
          body[mediaTypeElementName] = contentType;
        }
        const contentDispositionFilenameElementName =
          findElementValueByAnnotation(elements, "@Core.ContentDisposition.Filename") ||
          findElementValueByAnnotation(elements, "@Common.ContentDisposition.Filename");
        if (contentDispositionFilenameElementName && filename) {
          const element = elements[contentDispositionFilenameElementName];
          body[contentDispositionFilenameElementName] = decodeHeaderValue(definition, element, element.name, filename);
        }
        const postUrl = target + url.pathname;
        const postHeaders = propagateHeaders(req, {
          ...headers,
          "content-type": "application/json",
        });
        delete postHeaders["transfer-encoding"];

        // Trace
        traceRequest(req, "ProxyRequest", "POST", postUrl, postHeaders, body);

        const postBody = JSON.stringify(body);
        postHeaders["content-length"] = postBody.length;
        const response = await fetch(postUrl, {
          method: "POST",
          headers: postHeaders,
          body: postBody,
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
        req.url += `(${entityKey(responseBody, definition, elements, req)})/${mediaDataElementName}`;
        req.originalUrl = req.url;
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
          req.body,
        );
      });
    } else {
      await handleMediaEntity(
        headers["content-type"],
        headers["slug"] || headers["filename"] || contentDispositionFilename(headers) || headers["name"],
        headers,
      );
    }
  }

  function routeBeforeRequest(req, res, next) {
    if (typeof router.before === "function") {
      router.before(req, res, next);
    } else if (Array.isArray(router.before) && router.before.length > 0) {
      const routes = router.before.slice(0);

      function call() {
        try {
          const route = routes.shift();
          if (!route) {
            return next(null);
          }
          route(req, res, (err) => {
            if (err) {
              next(err);
            } else {
              call();
            }
          });
        } catch (err) {
          next(err);
        }
      }

      call();
    } else {
      next();
    }
  }

  function bindRoutes() {
    const routeMiddleware = createProxyMiddleware({
      target: `${target}${rewritePath}`,
      changeOrigin: true,
      selfHandleResponse: true,
      on: {
        error: convertProxyError,
        proxyReq: convertProxyRequest,
        proxyRes: convertProxyResponse,
      },
      logger: cds.log("cov2ap"),
    });
    router.use(`/${path}`, routeBeforeRequest);
    router.use(`/${path}`, routeInitRequest);
    router.get(`/${path}/*\\$metadata`, routeGetMetadata);
    router.use(`/${path}`, routeBodyParser, routeSetContext, routeFileUpload, routeMiddleware);
  }

  cds.on("listening", ({ server, url }) => {
    if (target === "auto") {
      target = defaultTarget;
      port = server.address().port;
      target = url;
    }
    bindRoutes();
  });

  function contentDispositionFilename(headers) {
    const contentDispositionHeader = headers["content-disposition"] || headers["Content-Disposition"];
    if (contentDispositionHeader) {
      const filenameMatch = contentDispositionHeader.match(/^.*filename="(.*)"$/is);
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
        }
      });
    }
    return value;
  }

  function serviceFromRequest(req) {
    const servicePathUrl = normalizeSlashes(req.params["0"] || req.url); // wildcard or non-wildcard
    const servicePath = targetPath ? `/${targetPath}${servicePathUrl}` : servicePathUrl;
    const service = {
      name: "",
      path: "",
      valid: true,
      absolute: false,
    };

    Object.assign(
      service,
      determineMostSelectiveService(
        Object.keys(services)
          .map((path) => {
            if (servicePath.toLowerCase().startsWith(normalizeSlashes(path).toLowerCase())) {
              return {
                name: services[path],
                path: stripSlashes(path),
              };
            }
          })
          .filter((entry) => !!entry),
      ),
    );

    if (!service.name) {
      Object.assign(
        service,
        determineMostSelectiveService(
          Object.keys(cds.services)
            .map((service) => {
              const path = serviceODataV4Path(cds.services[service]);
              if (path) {
                const absolute = !normalizeSlashes(path)
                  .toLowerCase()
                  .startsWith(normalizeSlashes(targetPath).toLowerCase());
                if (
                  convertUrlAbsolutePath(absolute, servicePath)
                    .toLowerCase()
                    .startsWith(normalizeSlashes(path).toLowerCase())
                ) {
                  return {
                    name: service,
                    path: stripSlashes(path),
                    absolute,
                  };
                }
              }
            })
            .filter((entry) => !!entry),
        ),
      );
    }

    if (!service.name) {
      Object.assign(
        service,
        determineMostSelectiveService(
          Object.keys(cds.services)
            .map((service) => {
              const path = serviceODataV4Path(cds.services[service]);
              if (path) {
                if (servicePathUrl.toLowerCase().startsWith(normalizeSlashes(path).toLowerCase())) {
                  return {
                    name: service,
                    path: stripSlashes(path),
                    absolute: true,
                  };
                }
              }
            })
            .filter((entry) => !!entry),
        ),
      );
    }

    if (!service.name) {
      Object.assign(
        service,
        determineMostSelectiveService(
          Object.keys(cds.services)
            .map((service) => {
              const path = serviceODataV4Path(cds.services[service]);
              if (path === "/") {
                return {
                  name: service,
                  path: "",
                };
              }
            })
            .filter((entry) => !!entry),
        ),
      );
    }

    if (!service.name || !req.csn.definitions[service.name] || req.csn.definitions[service.name].kind !== "service") {
      logWarn(req, "Service", "Invalid service", {
        name: service.name,
        path: service.path,
      });
      service.valid = false;
    }
    if (service.name && req.csn.definitions[service.name] && !isServedViaOData(req.csn.definitions[service.name])) {
      logWarn(req, "Service", "Invalid service protocol", {
        name: service.name,
        path: service.path,
      });
      const error = new Error("Invalid service protocol. Only OData services supported");
      error.statusCode = 400;
      throw error;
    }
    if (req.csn.definitions[service.name] && req.csn.definitions[service.name]["@cov2ap.ignore"]) {
      const error = new Error("Service is not exposed as OData V2 protocol");
      error.statusCode = 400;
      throw error;
    }
    return {
      name: service.name,
      path: service.path,
      valid: service.valid,
      absolute: service.absolute,
    };
  }

  function serviceODataV2Path(service) {
    if (Array.isArray(service.endpoints)) {
      const odataV2Endpoint = service.endpoints.find((endpoint) => ["odata-v2"].includes(endpoint.kind));
      if (odataV2Endpoint) {
        return odataV2Endpoint.path;
      }
    }
  }

  function serviceODataV4Path(service) {
    if (Array.isArray(service.endpoints)) {
      const odataV4Endpoint = service.endpoints.find((endpoint) => ["odata", "odata-v4"].includes(endpoint.kind));
      if (odataV4Endpoint) {
        return odataV4Endpoint.path;
      }
    }
    return service.path;
  }

  function determineMostSelectiveService(services) {
    services.sort((a, b) => {
      return b.path.length - a.path.length;
    });
    if (services.length > 0) {
      return services[0];
    }
    return null;
  }

  function isServedViaOData(service) {
    let protocols = service["@protocol"];
    if (protocols) {
      protocols = !Array.isArray(protocols) ? [protocols] : protocols;
      return protocols.some((protocol) => {
        return (typeof protocol === "string" ? protocol : protocol.kind).startsWith("odata");
      });
    }
    const protocolDirect = Object.keys(cds.env.protocols || {}).find((protocol) => service["@" + protocol]);
    if (protocolDirect) {
      return protocolDirect.startsWith("odata");
    }
    return true;
  }

  async function getMetadata(req, service) {
    let metadata;
    if (req.tenant) {
      if (mtxRemote && mtxEndpoint) {
        metadata = await getTenantMetadataRemote(req, service);
      } else if (cds.mtx && cds.env.requires && cds.env.requires.multitenancy) {
        metadata = await getTenantMetadataLocal(req, service);
      } else if (cds.env.requires && cds.env.requires["cds.xt.ModelProviderService"]) {
        metadata = await getTenantMetadataStreamlined(req, service);
      }
    }
    if (!metadata) {
      metadata = await getDefaultMetadata(req, service);
    }
    return metadata;
  }

  async function getTenantMetadataRemote(req, service) {
    const mtxBasePath =
      mtxEndpoint.startsWith("http://") || mtxEndpoint.startsWith("https://") ? mtxEndpoint : `${target}${mtxEndpoint}`;
    return await prepareMetadata(
      req.tenant,
      async (tenant) => {
        const response = await fetch(`${mtxBasePath}/metadata/csn/${tenant}`, {
          method: "GET",
          headers: propagateHeaders(req),
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        return response.json();
      },
      async (tenant, service, locale) => {
        const response = await fetch(
          `${mtxBasePath}/metadata/edmx/${tenant}?name=${service}&language=${locale}&odataVersion=v2`,
          {
            method: "GET",
            headers: propagateHeaders(req),
          },
        );
        if (!response.ok) {
          throw new Error(await response.text());
        }
        return response.text();
      },
      service,
      determineLocale(req),
    );
  }

  async function getTenantMetadataLocal(req, service) {
    metadataCache[req.tenant] = metadataCache[req.tenant] || {};
    const isExtended = await callCached(metadataCache[req.tenant], "isExtended", () => {
      return cds.mtx.isExtended(req.tenant);
    });
    if (isExtended) {
      return await prepareMetadata(
        req.tenant,
        async (tenant) => {
          return await cds.mtx.getCsn(tenant);
        },
        async (tenant, service, locale) => {
          return await cds.mtx.getEdmx(tenant, service, locale, "v2");
        },
        service,
        determineLocale(req),
      );
    }
  }

  async function getTenantMetadataStreamlined(req, service) {
    metadataCache[req.tenant] = metadataCache[req.tenant] || {};
    const { "cds.xt.ModelProviderService": mps } = cds.services;
    if (mps) {
      const isExtended = await callCached(metadataCache[req.tenant], "isExtended", () => {
        return mps.isExtended({
          tenant: req.tenant,
        });
      });
      if (isExtended) {
        return await prepareMetadata(
          req.tenant,
          async (tenant) => {
            return await mps.getCsn({
              tenant,
              toggles: ensureArray(req.features),
              for: "nodejs",
            });
          },
          async (tenant, service, locale) => {
            return await mps.getEdmx({
              tenant,
              toggles: ensureArray(req.features),
              service,
              locale,
              flavor: "v2",
              for: "nodejs",
            });
          },
          service,
          determineLocale(req),
        );
      }
    }
  }

  async function getDefaultMetadata(req, service) {
    return await prepareMetadata(
      DefaultTenant,
      async () => {
        if (typeof model === "object" && !Array.isArray(model)) {
          return model;
        }
        return await cds.load(model);
      },
      async () => {},
      service,
      determineLocale(req),
    );
  }

  async function prepareMetadata(tenant, loadCsn, loadEdmx, service, locale) {
    metadataCache[tenant] = metadataCache[tenant] || {};
    const csn = await callCached(metadataCache[tenant], "csn", () => {
      return prepareCSN(tenant, loadCsn);
    });
    if (!service) {
      return { csn };
    }
    metadataCache[tenant].edmx = metadataCache[tenant].edmx || {};
    metadataCache[tenant].edmx[service] = metadataCache[tenant].edmx[service] || {};
    const edmx = await callCached(metadataCache[tenant].edmx[service], locale, async () => {
      const edmx = await prepareEdmx(tenant, csn, loadEdmx, service, locale);
      if (["disk", "stream"].includes(cacheMetadata)) {
        const edmxFilename = fsPath.join(CACHE_DIR, `${tenant}$${service}$${locale}.edmx.xml`);
        await fs.promises.writeFile(edmxFilename, edmx);
        return edmxFilename;
      }
      return edmx;
    });
    return { csn, edmx };
  }

  async function prepareCSN(tenant, loadCsn) {
    let csnRaw;
    if (cds.server && cds.model && tenant === DefaultTenant) {
      csnRaw = cds.model;
    } else {
      csnRaw = await loadCsn(tenant);
    }
    let csn;
    if (cds.compile.for.nodejs) {
      csn = cds.compile.for.nodejs(csnRaw);
    } else {
      csn = csnRaw.meta && csnRaw.meta.transformation === "odata" ? csnRaw : cds.linked(cds.compile.for.odata(csnRaw));
    }
    return csn;
  }

  async function prepareEdmx(tenant, csn, loadEdmx, service, locale) {
    let edmx;
    if (tenant !== DefaultTenant) {
      edmx = await loadEdmx(tenant, service, locale);
    }
    if (!edmx) {
      edmx = await edmxFromFile(tenant, service);
      if (!edmx) {
        edmx = await cds.compile.to.edmx(csn, {
          service,
          version: "v2",
        });
      }
      edmx = cds.localize(csn, locale, edmx);
    }
    return edmx;
  }

  async function edmxFromFile(tenant, service) {
    const filePath = cds.root + `/srv/odata/v2/${service}.xml`;
    let exists;
    try {
      exists = !(await fs.promises.access(filePath, fs.constants.F_OK));
    } catch (e) {
      logDebug({ tenant }, "Metadata", `No metadata file found for service ${service} at ${filePath}`);
    }
    if (exists) {
      return await fs.promises.readFile(filePath, "utf8");
    }
  }

  async function callCached(cache, field, call) {
    if (call && !cache[field]) {
      cache[field] = call();
    }
    try {
      return await cache[field];
    } catch (err) {
      delete cache[field];
      throw err;
    }
  }

  function localName(definition, req) {
    const localName = isServiceName(definition.name, req) ? odataName(definition.name, req) : definition.name;
    const nameSuffix =
      definition.kind === "entity" &&
      definition.params &&
      req.context.parameters &&
      req.context.parameters.kind === "Set"
        ? "Set"
        : "";
    return localName + nameSuffix;
  }

  function isServiceName(name, req) {
    return name.startsWith(`${req.service}.`);
  }

  function odataName(name, req) {
    return name.substring(`${req.service}.`.length).replace(/\./g, "_");
  }

  function qualifiedODataName(name, req) {
    return `${req.service}.${odataName(name, req)}`;
  }

  function qualifiedName(name, req) {
    const serviceNamespacePrefix = `${req.service}.`;
    return (name.startsWith(serviceNamespacePrefix) ? "" : serviceNamespacePrefix) + name;
  }

  function qualifiedSubName(name, req) {
    if (name.includes("_")) {
      const parts = name.split("_");
      const endPart = parts.pop();
      name = `${parts.join("_")}.${endPart}`;
    }
    return qualifiedName(name, req);
  }

  function lookupDefinition(name, req) {
    if (["$metadata"].includes(name) || name.startsWith("cds.") || name.startsWith("Edm.")) {
      return;
    }
    const definitionName = qualifiedName(name, req);
    const definitionSubName = qualifiedSubName(name, req);
    const definition =
      req.csn.definitions[definitionSubName] || req.csn.definitions[definitionName] || req.csn.definitions[name];
    if (definition) {
      return definition;
    }
    for (const name in req.csn.definitions) {
      if (!isServiceName(name, req)) {
        continue;
      }
      if (definitionName === qualifiedODataName(name, req)) {
        return req.csn.definitions[name];
      }
    }
  }

  function lookupBoundDefinition(name, req) {
    for (const definitionName in req.csn.definitions) {
      const definition = req.csn.definitions[definitionName];
      if (definition.actions) {
        for (const actionName in definition.actions) {
          if (name.endsWith(`_${actionName}`)) {
            const entityName = name.substring(0, name.length - `_${actionName}`.length);
            const entityDefinition = lookupDefinition(entityName, req);
            if (entityDefinition === definition) {
              const boundAction = definition.actions[actionName];
              req.lookupContext.boundDefinition = definition;
              req.lookupContext.operation = boundAction;
              const returnDefinition = lookupReturnDefinition(boundAction.returns, req);
              if (returnDefinition) {
                req.lookupContext.returnDefinition = returnDefinition;
              }
              return boundAction;
            }
          }
        }
      }
    }
  }

  function lookupParametersDefinition(name, req) {
    const definitionTypeName = qualifiedName(name, req);
    let definitionKind;
    if (definitionTypeName.endsWith("Set")) {
      definitionKind = "Set";
    } else if (definitionTypeName.endsWith("Parameters")) {
      definitionKind = "Parameters";
    }
    if (definitionKind) {
      const definitionName = definitionTypeName.substring(0, definitionTypeName.length - definitionKind.length);
      const definition = req.csn.definitions[definitionName] || req.csn.definitions[name];
      if (definition && definition.kind === "entity" && definition.params) {
        req.lookupContext.parameters = {
          kind: definitionKind,
          entity: localName(definition, req),
          type: localName({ name: definitionTypeName }, req),
          values: {},
          keys: {},
          count: false,
        };
        return definition;
      }
    }
  }

  function enhanceParametersDefinition(context, req) {
    if (context && context.kind === "entity" && context.params) {
      req.lookupContext.parameters = req.lookupContext.parameters || {
        kind: "Parameters",
        entity: localName(context, req),
        type: localName(context, req),
        values: {},
        keys: {},
        count: false,
      };
    }
  }

  function convertProxyError(err, req, res) {
    logError(req, "Proxy", err);
    if (!req && !res) {
      throw err;
    }
    if (res.writeHead && !res.headersSent) {
      if (/HPE_INVALID/.test(err.code)) {
        res.writeHead(502);
      } else {
        switch (err.code) {
          case "ECONNRESET":
          case "ENOTFOUND":
          case "ECONNREFUSED":
          case "ETIMEDOUT":
            res.writeHead(504);
            break;
          default:
            res.writeHead(500);
        }
      }
    }
    if (!res.writableEnded) {
      res.end("Unexpected error occurred while processing request");
    }
  }

  /**
   * Convert Proxy Request (V2 -> V4)
   * @param proxyReq Proxy Request
   * @param req Request
   * @param res Response
   */
  async function convertProxyRequest(proxyReq, req, res) {
    try {
      // Trace
      traceRequest(req, "Request", req.method, req.originalUrl, req.headers, req.body);

      const headers = propagateHeaders(req);
      let body = req.body;
      let contentType = req.header("content-type");

      if (isMultipartMixed(contentType)) {
        // Multipart
        req.contentIdOrder = [];
        if (req.method === "HEAD") {
          body = "";
        } else {
          body = processMultipartMixed(
            req,
            body,
            contentType,
            ({ method, url }) => {
              method = convertMethod(method);
              url = convertUrlAndSetContext(url, req, method);
              return { method, url };
            },
            ({ contentType, body, headers, url, contentId }) => {
              if (contentId) {
                req.contentId[`$${contentId}`] = req.context.url;
              }
              delete headers["odata-version"];
              delete headers["Odata-Version"];
              delete headers.dataserviceversion;
              delete headers.DataServiceVersion;
              delete headers.maxdataserviceversion;
              delete headers.MaxDataServiceVersion;
              if (isResponseFormatXML(req.context, headers)) {
                req.context.serviceResponseAsXML = true;
              }
              if (headers.accept && !headers.accept.includes("application/json")) {
                headers.accept = "application/json," + headers.accept;
              }
              if (isXML(contentType)) {
                req.context.serviceRequestAsXML = true;
                body = convertRequestBodyFromXML(body, req);
                contentType = "application/json";
                headers["content-type"] = contentType;
              }
              if (headers["sap-messages"]) {
                req.context.messages = headers["sap-messages"];
              }
              if (isApplicationJSON(contentType)) {
                if (ieee754Compatible) {
                  contentType = enrichApplicationJSON(contentType);
                  headers["content-type"] = contentType;
                }
                body = convertRequestBody(body, headers, url, req);
              }
              if (body !== undefined) {
                for (const name in headers) {
                  if (name.toLowerCase() === "content-length") {
                    headers[name] = Buffer.byteLength(body);
                    break;
                  }
                }
              }
              return { body, headers };
            },
            req.contentIdOrder,
            ProcessingDirection.Request,
          );
        }
        proxyReq.path = convertUrlAbsolutePath(req.serviceAbsolute, proxyReq.path);
        headers.accept = "multipart/mixed,application/json";
        proxyReq.setHeader("accept", headers.accept);
      } else {
        // Single
        proxyReq.method = convertMethod(proxyReq.method);
        proxyReq.path = convertUrlAndSetContext(proxyReq.path, req, proxyReq.method);
        if (
          req.context.serviceRoot &&
          (!headers.accept || headers.accept.includes("xml")) &&
          req.query.$format !== "json"
        ) {
          req.context.serviceRootAsXML = true;
          headers.accept = "application/json";
          proxyReq.setHeader("accept", headers.accept);
        }
        if (isResponseFormatXML(req.context, headers)) {
          req.context.serviceResponseAsXML = true;
        }
        if (headers.accept && !headers.accept.includes("application/json")) {
          headers.accept = "application/json," + headers.accept;
          proxyReq.setHeader("accept", headers.accept);
        }
        if (headers["sap-messages"]) {
          req.context.messages = headers["sap-messages"];
        }
        if (isXML(contentType)) {
          req.context.serviceRequestAsXML = true;
          body = convertRequestBodyFromXML(body, req);
          contentType = "application/json";
        }
        if (isApplicationJSON(contentType)) {
          if (ieee754Compatible) {
            contentType = enrichApplicationJSON(contentType);
          }
          body = convertRequestBody(body, req.headers, proxyReq.path, req);
        }
      }

      Object.entries(headers).forEach(([name, value]) => {
        if (
          [
            "odata-version",
            "Odata-Version",
            "dataserviceversion",
            "DataServiceVersion",
            "maxdataserviceversion",
            "MaxDataServiceVersion",
          ].includes(name)
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
      proxyReq.method = convertMethod(proxyReq.method);

      if (contentType) {
        if (body !== undefined) {
          // File Upload
          if (req.files && Object.keys(req.files).length === 1) {
            const file = req.files[Object.keys(req.files)[0]];
            contentType = body["content-type"] || file.mimetype;
            body = file.data;
          }
          proxyReq.setHeader("content-type", contentType);
          body = normalizeBody(body);
          proxyReq.setHeader("content-length", Buffer.byteLength(body));
          proxyReq.write(body);
        }
      }

      // Trace
      traceRequest(req, "ProxyRequest", proxyReq.method, proxyReq.path, headers, body);
    } catch (err) {
      // Error
      if (err.statusCode === 400) {
        logWarn(req, "Request", err);
      } else {
        logError(req, "Request", err);
      }
      // Trace
      logWarn(req, "Request", "Request with Error", {
        method: req.method,
        url: req.originalUrl,
        target,
      });
      if (err.statusCode) {
        res.status(err.statusCode).send(err.message);
      } else {
        res.status(500).send("Internal Server Error");
      }
    }
  }

  function convertMethod(method) {
    return method === "MERGE" ? "PATCH" : method;
  }

  function isResponseFormatXML(context, headers) {
    if (context.$format === "atom") {
      return true;
    } else if (!headers.accept && !context.$format && defaultFormat === "atom") {
      return true;
    } else if (
      headers.accept &&
      headers.accept.includes("xml") &&
      (defaultFormat === "atom" || (!headers.accept.includes("json") && !headers.accept.includes("html"))) &&
      context.$format !== "json"
    ) {
      return true;
    }
    return false;
  }

  function convertUrlAndSetContext(urlPath, req, method) {
    const url = parseUrl(urlPath, req);
    const definition = lookupContextFromUrl(url, req);
    enrichRequest(definition, url, urlPath, req, method);
    convertUrl(url, req);
    return URL.format(url);
  }

  function convertUrlAbsolutePath(absolute, path) {
    if (absolute && path.startsWith(`/${targetPath}`)) {
      return path.substring(targetPath.length + 1);
    }
    return path;
  }

  function parseUrl(urlPath, req) {
    const url = URL.parse(urlPath, true);
    url.pathname = (url.pathname && url.pathname.replace(/%27/g, "'")) || "";
    url.pathname = convertUrlAbsolutePath(req.serviceAbsolute, url.pathname);
    url.originalUrl = { ...url, query: { ...url.query } };
    url.basePath = "";
    url.servicePath = "";
    url.contextPath = url.pathname;
    if (req.base && url.contextPath.startsWith(`/${req.base}`)) {
      url.basePath = `/${req.base}`;
      url.contextPath = url.contextPath.substring(url.basePath.length);
    }
    if (url.contextPath.startsWith(`/${req.servicePath}`)) {
      url.servicePath = `/${req.servicePath}`;
      url.contextPath = url.contextPath.substring(url.servicePath.length);
    }
    if (url.contextPath.startsWith("/")) {
      url.servicePath += "/";
      url.contextPath = url.contextPath.substring(1);
    }
    url.originalUrl.servicePath = url.servicePath;
    url.originalUrl.contextPath = url.contextPath;
    // Normalize system and reserved query parameters (no array), others not (if array)
    Object.keys(url.query || {}).forEach((name) => {
      if (Array.isArray(url.query[name])) {
        if (name.startsWith("$") || ["search", "SideEffectsQualifier"].includes(name)) {
          url.query[name] = url.query[name][0];
        }
      }
    });
    return url;
  }

  function lookupContextFromUrl(url, req) {
    req.lookupContext = {};
    return contextFromUrl(url, req);
  }

  function contextFromUrl(url, req, context, suppressWarning) {
    let stop = false;
    return url.contextPath.split("/").reduce((context, part) => {
      if (stop || !part) {
        return context;
      }
      const keyStart = part.indexOf("(");
      if (keyStart !== -1) {
        part = part.substring(0, keyStart);
      }
      context = lookupContext(part, context, req, suppressWarning, url.contextPath);
      if (!context) {
        stop = true;
      }
      return context;
    }, context);
  }

  function lookupContext(name, context, req, suppressWarning, path) {
    if (!name) {
      return context;
    }
    name = decodeURIComponent(name);
    if (!context) {
      if (name.startsWith("$") && req.contentId[name]) {
        return contextFromUrl(req.contentId[name], req, undefined, suppressWarning);
      } else {
        context = lookupDefinition(name, req);
        if (!context) {
          context = lookupBoundDefinition(name, req);
        }
        if (!context) {
          context = lookupParametersDefinition(name, req);
        }
        enhanceParametersDefinition(context, req);
        if (!context) {
          if (suppressWarning === "debug") {
            logDebug(req, "Context", "Invalid definition", {
              name,
              path,
            });
          } else if (!suppressWarning) {
            logWarn(req, "Context", "Invalid definition", {
              name,
              path,
            });
          }
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
      const element = definitionElements(context)[name];
      if (element) {
        const type = elementType(element, req);
        if (type === "cds.Composition" || type === "cds.Association") {
          // Navigation
          return element._target;
        } else {
          // Element
          return context;
        }
      }
      if (context && context.kind === "entity" && context.params && ["Set", "Parameters"].includes(name)) {
        return context;
      }
      if (suppressWarning === "debug") {
        logDebug(req, "Context", "Invalid sub-definition", {
          name,
          path,
        });
      } else if (!suppressWarning) {
        logWarn(req, "Context", "Invalid sub-definition", {
          name,
          path,
        });
      }
    }
  }

  function enrichRequest(definition, url, urlPath, req, method) {
    req.context = {
      method,
      url,
      urlPath,
      serviceRoot: url.contextPath.length === 0,
      serviceRootAsXML: false,
      serviceRequestAsXML: false,
      serviceResponseAsXML: false,
      definition: definition,
      definitionElements: definitionElements(definition),
      requestDefinition: definition,
      serviceUri: "",
      operation: null,
      operationNested: false,
      boundDefinition: null,
      returnDefinition: null,
      bodyParameters: {},
      selects: [],
      $entityValue: false,
      $value: false,
      $count: false,
      $apply: null,
      $format: null,
      aggregationKey: false,
      aggregationFilter: "",
      parameters: null,
      messages: null,
      expandSiblingEntity: false,
      ...req.lookupContext,
    };
    req.contexts.push(req.context);
    return req.context;
  }

  function convertUrl(url, req) {
    // Order is important
    convertFormat(url, req);
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
    convertParameters(url, req);
    delete url.search;
    url.pathname = url.basePath + url.servicePath + url.contextPath;
  }

  function convertFormat(url, req) {
    req.context.$format = url.query.$format;
    if (url.query.$format === "atom") {
      delete url.query.$format;
    }
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
        if (stop || !part) {
          return part;
        }
        let name = part;
        let keyPart = "";
        const keyStart = part.indexOf("(");
        const keyEnd = part.lastIndexOf(")");
        if (keyStart !== -1 && keyEnd === part.length - 1) {
          name = part.substring(0, keyStart);
          keyPart = part.substring(keyStart + 1, keyEnd);
        }
        context = lookupContext(name, context, req, false, url.contextPath);
        if (!context) {
          stop = true;
        }
        const contextElements = definitionElements(context);
        const contextKeys = definitionKeys(context);
        if (context && keyPart) {
          const isAggregation = convertAggregationKey(keyPart, url, req);
          if (isAggregation) {
            return name;
          }
          const keys = decodeURIComponent(keyPart).split(",");
          return (
            name +
            encodeURIComponent(
              `(${keys
                .map((key) => {
                  const [name, value] = key.split("=");
                  let type;
                  if (name && value) {
                    if (context.params && context.params[name]) {
                      type = context.params[name].type;
                    }
                    if (!type) {
                      type = elementType(contextElements[name], req);
                    }
                    return `${name}=${replaceConvertDataTypeToV4(value, type)}`;
                  } else if (name) {
                    const key = Object.keys(contextKeys).find((key) => {
                      return contextKeys[key].type !== "cds.Composition" && contextKeys[key].type !== "cds.Association";
                    });
                    type = key && elementType(contextElements[key], req);
                    return type && `${replaceConvertDataTypeToV4(name, type)}`;
                  }
                  return "";
                })
                .filter((part) => !!part)
                .join(",")})`,
            )
          );
        } else {
          return part;
        }
      })
      .join("/");

    // Query
    Object.keys(url.query).forEach((name) => {
      if (name === "$filter") {
        url.query[name] = convertUrlDataTypesForFilter(url.query[name], context, req);
      } else if (!name.startsWith("$")) {
        const contextElements = definitionElements(context);
        if (contextElements[name]) {
          const element = contextElements[name];
          const type = elementType(element, req);
          if (DataTypeMap[type]) {
            url.query[name] = replaceConvertDataTypeToV4(url.query[name], type);
          }
        }
        if (context && (context.kind === "function" || context.kind === "action")) {
          if (context.params && context.params[name]) {
            const element = context.params[name];
            const type = elementType(element, req);
            if (DataTypeMap[type]) {
              url.query[name] = replaceConvertDataTypeToV4(url.query[name], type);
            }
          } else if (context.parent && context.parent.kind === "entity") {
            const parentElements = definitionElements(context.parent);
            if (parentElements[name]) {
              const element = parentElements[name];
              const type = elementType(element, req);
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
          const nextChar = input.substring(index + 1, index + 2);
          if (nextChar === "'") {
            quoteEscape = true;
            return;
          }
        }
        const typeStart = !!Object.keys(DataTypeMap)
          .filter((type) => !["cds.String", "cds.LargeString"].includes(type))
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

  function convertAggregationKey(keyPart, url, req) {
    const aggregationMatch =
      keyPart.match(/^aggregation'(.*)'$/is) ||
      keyPart.match(/^'aggregation'(.*)''$/is) ||
      keyPart.match(/^ID__='aggregation'(.*)''$/is);
    const aggregationKey = aggregationMatch && aggregationMatch.pop();
    if (aggregationKey) {
      // Aggregation Key
      try {
        const aggregation = JSON.parse(decodeURIKey(aggregationKey));
        if (url.query["$select"]) {
          url.query["$select"] += "," + (aggregation.value || []).join(",");
        } else {
          url.query["$select"] = (aggregation.value || []).join(",");
        }
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
        if (aggregation.search) {
          url.query["search"] = aggregation.search;
          req.context.aggregationSearch = aggregation.search;
        }
        req.context.aggregationKey = true;
      } catch (err) {
        // Error
        logError(req, "AggregationKey", err);
      }
      return true;
    }
    return false;
  }

  function convertUrlDataTypesForFilter(filter, context, req) {
    if (filter === null || filter === undefined) {
      return filter;
    }
    return buildQuoteParts(filter)
      .map((part) => {
        if (!part.quote) {
          convertUrlDataTypesForFilterElements(part, context, req);
        }
        return part.content;
      })
      .join("");
  }

  function convertUrlDataTypesForFilterElements(part, entity, req, path = "", depth = 0) {
    const elements = definitionElements(entity);
    for (const name of Object.keys(elements)) {
      const namePath = (path ? `${path}/` : "") + name;
      if (part.content.includes(namePath)) {
        const element = elements[name];
        const type = elementType(element, req);
        if (type !== "cds.Composition" && type !== "cds.Association") {
          if (DataTypeMap[type]) {
            const v4Regex = new RegExp(
              `(${namePath})(\\)?\\s+?(?:eq|ne|gt|ge|lt|le)\\s+?)${DataTypeMap[type].v4.source}`,
              DataTypeMap[type].v4.flags,
            );
            if (v4Regex.test(part.content)) {
              part.content = part.content.replace(v4Regex, (_, name, op, value) => {
                return `${name}${op}${convertDataTypeToV4(value, type)}`;
              });
            }
          }
        } else if (depth < 3 && (!element.cardinality || element.cardinality.max !== "*")) {
          convertUrlDataTypesForFilterElements(part, element._target, req, namePath, depth + 1);
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
    const operationLocalName = localName(definition, req);
    let reqContextPathSuffix = "";
    if (url.contextPath.startsWith(operationLocalName)) {
      reqContextPathSuffix = url.contextPath.substring(operationLocalName.length);
      url.contextPath = url.contextPath.substring(0, operationLocalName.length);
    }
    let queryOptions = { ...url.query };

    if (queryOptions.ID__) {
      const ID__ = unquoteValue(queryOptions.ID__);
      const aggregationMatch = ID__.match(/^aggregation'(.*)'$/is);
      if (aggregationMatch) {
        const aggregationKey = aggregationMatch && aggregationMatch.pop();
        try {
          const aggregation = JSON.parse(decodeURIKey(aggregationKey));
          queryOptions = { ...queryOptions, ...(aggregation.key || {}) };
          url.query.ID__ = ID__;
        } catch (err) {
          // Error
          logError(req, "AggregationKey", err);
        }
      }
    }

    // Key Parameters
    if (definition.parent && definition.parent.kind === "entity") {
      url.contextPath = localName(definition.parent, req);
      url.contextPath += `(${Object.keys(definitionKeys(definition.parent))
        .reduce((result, name) => {
          const parentElements = definitionElements(definition.parent);
          const element = parentElements[name];
          const type = elementType(element, req);
          if (!(type === "cds.Composition" || type === "cds.Association")) {
            const value = queryOptions[name];
            result.push(`${name}=${quoteParameter(element, encodeURIComponent(value), req)}`);
            delete url.query[name];
          }
          return result;
        }, [])
        .join(",")})`;
      url.contextPath += `/${req.service}.${definition.name}`;
    }
    // Function Parameters
    if (definition.kind === "function") {
      url.contextPath += `(${Object.keys(queryOptions)
        .reduce((result, name) => {
          if (!name.startsWith("$")) {
            const element = definition.params && definition.params[name];
            if (element) {
              let value = queryOptions[name];
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
      Object.keys(queryOptions).forEach((name) => {
        if (!name.startsWith("$")) {
          const element = definition.params && definition.params[name];
          if (element) {
            let value = queryOptions[name];
            if (Array.isArray(value)) {
              value = value.map((entry) => {
                return unescapeSingleQuote(element, unquoteParameter(element, entry, req), req);
              });
            } else {
              value = unescapeSingleQuote(element, unquoteParameter(element, value, req), req);
              if (element.items && element.items.type) {
                value = [value];
              }
            }
            req.context.bodyParameters[name] = value;
            delete url.query[name];
          }
        }
      });
    }
  }

  function unescapeSingleQuote(element, value, req) {
    if (
      element &&
      value &&
      typeof value === "string" &&
      ["cds.String", "cds.LargeString"].includes(elementType(element, req))
    ) {
      return value.replace(/''/g, "'");
    }
    return value;
  }

  function quoteParameter(element, value, req, quote = "'") {
    if (element && ["cds.String", "cds.LargeString"].includes(elementType(element, req))) {
      return `${quote}${unquoteParameter(element, value, req)}${quote}`;
    }
    return value;
  }

  function unquoteParameter(element, value, req) {
    if (
      element &&
      value &&
      typeof value === "string" &&
      [
        "cds.String",
        "cds.LargeString",
        "cds.UUID",
        "cds.Binary",
        "cds.LargeBinary",
        "cds.Date",
        "cds.Time",
        "cds.DateTime",
        "cds.Timestamp",
      ].includes(elementType(element, req))
    ) {
      return value.replace(/^['](.*)[']$/s, "$1");
    }
    return value;
  }

  function unquoteValue(value) {
    if (value && typeof value === "string" && value.match(/^['](.*)[']$/s)) {
      return value.replace(/^['](.*)[']$/s, "$1").replace(/''/g, "'");
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
        let expands = url.query["$expand"].split(",");
        if (definition.kind === "entity" && definition.params) {
          expands = expands.filter((expand) => !["Set", "Parameters"].includes(expand));
        }
        expands.forEach((expand) => {
          if (fixDraftRequests && expand === "SiblingEntity") {
            req.context.expandSiblingEntity = true;
            return;
          }
          let current = context.expand;
          expand.split("/").forEach((part) => {
            current[part] = current[part] || { select: {}, expand: {} };
            current = current[part].expand;
          });
        });
      }
      if (url.query["$select"]) {
        req.context.selects = url.query["$select"].split(",");
        req.context.selects.forEach((select) => {
          let current = context;
          let currentDefinition = definition;
          const parts = select.split("/");
          parts.forEach((part, index) => {
            if (!current) {
              return;
            }
            if (part === "*") {
              current.select[part] = true;
            } else {
              const element = definitionElements(currentDefinition)[part];
              if (element) {
                current.select[part] = true;
                const type = elementType(element, req);
                if (type === "cds.Composition" || type === "cds.Association") {
                  current = current.expand[part];
                  if (current && index === parts.length - 1) {
                    current.all = true;
                  }
                  currentDefinition = element._target;
                }
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
              const selects = value.all ? [] : Object.keys(value.select);
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
      // Fix unsupported draft requests
      if (fixDraftRequests) {
        const match = filter.match(UnsupportedDraftFilterRegex);
        if (match && match.length === 3 && match[1] === match[2]) {
          filter = filter.replace(match[0], encodeReplaceValue(match[1]));
          url.query["$filter"] = filter;
        }
      }
      // Convert functions
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
            const placeholders = (name.match(/[$]/g) || []).length;
            const pattern = name
              .replace(/([()])/g, `${_}\\$1${i}${_}`)
              .replace(/([,])/g, `${_}$1${i}${_}`)
              .replace(/[$]/g, "(.*?)");
            filter = filter.replace(new RegExp(pattern, "gi"), (...args) => {
              let result = FilterFunctions[name];
              for (let j = 1; j <= placeholders; j++) {
                if (args[j] !== undefined) {
                  result = result.replace(`$${j}`, encodeReplaceValue(args[j].trim()));
                }
              }
              return result;
            });
          });
          filter = filter.replace(new RegExp(`${_}([(),])${i}${_}`, "g"), "$1");
        }
        url.query["$filter"] = filter;
      }
    }
  }

  function convertSearch(url, req) {
    if (url.query.search) {
      let search = url.query.search;
      if (quoteSearch || (!/^".*"$/s.test(search) && search.includes('"'))) {
        search = `"${search.replace(/\\/g, "\\\\").replace(/"/g, `\\"`)}"`;
      }
      url.query["$search"] = search;
      delete url.query.search;
    }
  }

  function convertAnalytics(url, req) {
    const definition = req.context && req.context.definition;
    if (!(isAnalyticsEntity(definition) && url.query["$select"])) {
      return;
    }
    const elements = req.context.definitionElements;
    const keyDimensions = [];
    for (const name of Object.keys(elements)) {
      const element = elements[name];
      if (isDimensionElement(element) && element.key) {
        keyDimensions.push(element);
      }
    }
    const measures = [];
    const dimensions = [];
    const selects = url.query["$select"].split(",");
    const values = [];
    selects.forEach((select) => {
      const element = elements[select];
      if (element) {
        values.push(element);
      }
    });
    selects.forEach((select) => {
      const element = elements[select];
      if (element) {
        if (isMeasureElement(element)) {
          measures.push(element);
        } else {
          // isDimensionElement(element)
          dimensions.push(element);
        }
      }
    });

    if (
      definition["@cov2ap.analytics.skipForKey"] &&
      keyDimensions.every((keyDimension) => dimensions.includes(keyDimension))
    ) {
      return;
    }

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
            const aggregation = aggregationDefault(measure);
            const aggregationName = aggregation ? aggregation["#"] || aggregation : DefaultAggregation;
            const aggregationFunction = aggregationName ? AggregationMap[aggregationName.toUpperCase()] : undefined;
            if (!aggregationFunction) {
              throw new Error(`Aggregation '${aggregationName}' is not supported`);
            }
            if ([AggregationMap.NONE, AggregationMap.NOP].includes(aggregationFunction)) {
              return null;
            }
            if (aggregationFunction.startsWith("$")) {
              return `${aggregationFunction} as ${AggregationPrefix}${measure.name}`;
            } else {
              return `${referenceElement(measure) || measure.name} with ${aggregationFunction} as ${AggregationPrefix}${
                measure.name
              }`;
            }
          })
          .filter((aggregation) => !!aggregation)
          .join(",")})`;
      }
      if (dimensions.length) {
        url.query["$apply"] += ")";
      }

      const filter = url.query["$filter"];
      if (filter) {
        url.query["$apply"] = `filter(${filter})/` + url.query["$apply"];
      }
      const search = url.query["$search"];
      if (search) {
        url.query["$apply"] = `search(${search})/` + url.query["$apply"];
      }

      if (url.query["$orderby"]) {
        url.query["$orderby"] = url.query["$orderby"]
          .split(",")
          .map((orderBy) => {
            let [name, order] = orderBy.split(" ");
            const element = elements[name];
            if (element && isMeasureElement(element)) {
              name = `${AggregationPrefix}${element.name}`;
            }
            return name + (order ? ` ${order}` : "");
          })
          .join(",");
      }

      delete url.query["$filter"];
      delete url.query["$select"];
      delete url.query["$expand"];
      delete url.query["$search"];

      req.context.$apply = {
        key: dimensions,
        value: values,
        filter: req.context.aggregationKey ? req.context.aggregationFilter : filter,
        search: req.context.aggregationKey ? req.context.aggregationSearch : search,
      };
    }
  }

  function isAnalyticsEntity(entity) {
    return (
      entity &&
      entity.kind === "entity" &&
      entity["@cov2ap.analytics"] !== false &&
      (entity["@cov2ap.analytics"] ||
        entity["@cov2ap.analytics.skipForKey"] ||
        entity["@Analytics"] ||
        entity["@Analytics.AnalyticalContext"] ||
        entity["@Analytics.query"] ||
        entity["@AnalyticalContext"] ||
        entity["@Aggregation.ApplySupported.PropertyRestrictions"] ||
        entity["@sap.semantics"] === "aggregate")
    );
  }

  function isDimensionElement(element) {
    return (
      element["@Analytics.AnalyticalContext.Dimension"] ||
      element["@AnalyticalContext.Dimension"] ||
      element["@Analytics.Dimension"] ||
      element["@sap.aggregation.role"] === "dimension"
    );
  }

  function isMeasureElement(element) {
    return (
      element["@Analytics.AnalyticalContext.Measure"] ||
      element["@AnalyticalContext.Measure"] ||
      element["@Analytics.Measure"] ||
      element["@sap.aggregation.role"] === "measure"
    );
  }

  function aggregationDefault(element) {
    return element["@Aggregation.default"] || element["@Aggregation.Default"] || element["@DefaultAggregation"];
  }

  function referenceElement(element) {
    return (
      element["@Aggregation.referenceElement"] ||
      element["@Aggregation.ReferenceElement"] ||
      element["@Aggregation.reference"] ||
      element["@Aggregation.Reference"]
    );
  }

  function convertValue(url, req) {
    if (url.contextPath.endsWith("/$value")) {
      url.contextPath = url.contextPath.substring(0, url.contextPath.length - "/$value".length);
      const mediaDataElementName =
        req.context &&
        req.context.definition &&
        findElementByAnnotation(req.context.definitionElements, "@Core.MediaType");
      const endingElementName = findEndingElementName(req.context.definitionElements, url);
      if (!endingElementName) {
        url.contextPath += `/${mediaDataElementName}`;
        req.context.$entityValue = true;
      } else if (endingElementName !== mediaDataElementName) {
        req.context.$value = true;
      }
    }
  }

  function convertParameters(url, req) {
    if (req.context.parameters) {
      let context;
      let stop = false;
      url.contextPath = url.contextPath
        .split("/")
        .map((part) => {
          if (part === "Set" || part.startsWith("Set(")) {
            req.context.parameters.kind = "Set";
            stop = true;
          } else if (part === "Parameters" || part.startsWith("Parameters(")) {
            req.context.parameters.kind = "Parameters";
            stop = true;
          } else if (part === "$count") {
            req.context.parameters.count = true;
          }
          if (stop || !part) {
            return "";
          }
          let name = part;
          let keyPart = "";
          const keyStart = part.indexOf("(");
          const keyEnd = part.lastIndexOf(")");
          if (keyStart !== -1 && keyEnd === part.length - 1) {
            name = part.substring(0, keyStart);
            keyPart = part.substring(keyStart + 1, keyEnd);
          }
          if (name === req.context.parameters.type) {
            name = req.context.parameters.entity;
          }
          context = lookupContext(name, context, req, false, url.contextPath);
          if (!context) {
            stop = true;
          }
          const contextElements = definitionElements(context);
          if (context && keyPart) {
            const keys = decodeURIComponent(keyPart).split(",");
            return (
              name +
              encodeURIComponent(
                `(${keys
                  .map((key) => {
                    const [name, value] = key.split("=");
                    if (name && value) {
                      if (context.params[name]) {
                        req.context.parameters.values[name] = unquoteParameter(context.params[name], value, req);
                        return `${name}=${value}`;
                      } else {
                        req.context.parameters.keys[name] = unquoteParameter(contextElements[name], value, req);
                      }
                    } else if (name) {
                      const param = Object.keys(context.params).find(() => true);
                      if (param) {
                        if (context.params[param]) {
                          req.context.parameters.values[param] = unquoteParameter(context.params[param], name, req);
                          return `${param}=${name}`;
                        } else {
                          req.context.parameters.keys[param] = unquoteParameter(contextElements[param], name, req);
                        }
                      }
                    }
                    return "";
                  })
                  .filter((part) => !!part)
                  .join(",")})`,
              )
            );
          } else {
            return name;
          }
        })
        .filter((part) => !!part)
        .join("/");
      if (!url.contextPath.endsWith("/Set")) {
        url.contextPath = `${url.contextPath}/Set`;
      }
      if (req.context.parameters.count) {
        url.contextPath += "/$count";
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
      if (body.d && typeof body.d === "object") {
        body = body.d;
      }
      convertRequestData(body, headers, definition, req);
    }
    return JSON.stringify(body);
  }

  function convertRequestData(data, headers, definition, req) {
    if (!Array.isArray(data)) {
      return convertRequestData([data], headers, definition, req);
    }
    const elements = definitionElements(definition);
    if (Object.keys(elements).length === 0) {
      return;
    }
    // Modify Payload
    data.forEach((data) => {
      delete data.__metadata;
      delete data.__count;
      convertDataTypesToV4(data, headers, definition, elements, req);
    });
    // Recursion
    data.forEach((data) => {
      Object.keys(data).forEach((key) => {
        const element = elements[key];
        if (!element) {
          return;
        }
        const type = elementType(element, req);
        if (!type) {
          if (element.items) {
            convertRequestData(data[key], headers, element.items, req);
          } else if (element.elements) {
            convertRequestData(data[key], headers, element, req);
          }
        }
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

  function convertDataTypesToV4(data, headers, definition, elements, req) {
    Object.keys(data || {}).forEach((key) => {
      if (data[key] === null) {
        return;
      }
      const element = elements[key];
      if (element) {
        data[key] = convertDataTypeToV4(data[key], elementType(element, req), definition, headers);
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
    if (DataTypeMap[type] && typeof value === "string") {
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
      const match = value.match(/\\?\/Date\((.*)\)\\?\//is);
      const ticksAndOffset = match && match.pop();
      if (ticksAndOffset !== undefined && ticksAndOffset !== null) {
        value = new Date(calculateTicksOffsetSum(ticksAndOffset)).toISOString(); // always UTC
      }
      if (["cds.DateTime"].includes(type)) {
        value = value.slice(0, 19) + "Z"; // Cut millis
      } else if (["cds.Date"].includes(type)) {
        value = value.slice(0, 10); // Cut time
      } else if (["cds.Timestamp"].includes(type)) {
        if (!value.endsWith("Z")) {
          value += "Z";
        }
      }
    }
    return value;
  }

  function calculateTicksOffsetSum(text) {
    return (text.replace(/\s/g, "").match(/[+-]?([0-9]+)/g) || []).reduce((sum, value, index) => {
      return sum + parseFloat(value) * (index === 0 ? 1 : 60 * 1000); // ticks are milliseconds (0), offset are minutes (1)
    }, 0);
  }

  function convertRequestBodyFromXML(body, req) {
    if (typeof body === "string") {
      xmlParser.parseString(body, (err, xml) => {
        if (err) {
          throw err;
        }
        body = xml;
      });
    }
    return convertRequestDataFromXML(body && body.entry, req);
  }

  function convertRequestDataFromXML(data, req) {
    const result = {};
    if (data && data.content && data.content[0] && data.content[0].properties && data.content[0].properties[0]) {
      const properties = data.content[0].properties[0];
      Object.keys(properties).forEach((name) => {
        const property = properties[name] && properties[name][0];
        if (typeof property === "object") {
          if (property._ !== undefined) {
            result[name] = property._;
          }
          if (property.$ !== undefined) {
            Object.keys(property.$).forEach((key) => {
              if (key.endsWith("null") && property.$[key] === "true") {
                result[name] = null;
              }
            });
          }
        } else {
          result[name] = property;
        }
        return result[name];
      });
    }
    if (data && data.link) {
      data.link.forEach((link) => {
        if (link.$ && link.$.rel && link.inline && link.inline[0]) {
          const name = link.$.rel.split("/").pop();
          if (link.inline[0].feed && link.inline[0].feed[0]) {
            result[name] = result[name] || [];
            (link.inline[0].feed[0].entry || []).forEach((entry) => {
              result[name].push(convertRequestDataFromXML(entry, req));
            });
          } else if (link.inline[0].entry && link.inline[0].entry[0]) {
            result[name] = convertRequestDataFromXML(link.inline[0].entry[0], req);
          } else {
            result[name] = null;
          }
        }
      });
    }
    return result;
  }

  function initContext(req, index = 0) {
    req.context = req.contexts[index] || {};
    return req.context.definition && req.context.definition.kind === "entity"
      ? req.context.definition
      : req.context.boundDefinition;
  }

  /**
   * Convert Proxy Response (V4 -> V2)
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
                  if (statusCode === 204) {
                    body = "";
                  } else {
                    body = convertResponseBody(Object.assign({}, body), headers, req);
                  }
                }
              } else {
                convertHeaders(body, headers, serviceDefinition, req);
                body = convertResponseError(body, headers, serviceDefinition, req);
              }
              let statusCodeText;
              if (
                req.context.method === "GET" &&
                statusCode !== 204 &&
                isApplicationJSON(contentType) &&
                isEmptyJSON(body)
              ) {
                statusCode = 404;
                body = notFoundErrorResponse();
                statusCodeText = body.error.message;
                body = convertResponseError(body, headers, serviceDefinition, req);
              }
              if (body && statusCode !== 204) {
                setContentLength(headers, body);
              } else {
                clearContentLength(headers);
              }
              return { statusCode, statusCodeText, body, headers };
            },
            resContentIdOrder,
            ProcessingDirection.Response,
          );
          if (
            !(
              req.contentIdOrder.length === resContentIdOrder.length &&
              req.contentIdOrder.every((contentId, index) => contentId === resContentIdOrder[index])
            )
          ) {
            log(req, changesetDeviationLogLevel, "Batch", "Changeset order deviation", {
              req: req.contentIdOrder,
              res: resContentIdOrder,
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
      } else {
        // No body or failed
        const serviceDefinition = initContext(req);
        convertHeaders(body, headers, serviceDefinition, req);
        body = convertResponseError(body, headers, serviceDefinition, req);
      }
      if (req.method === "GET" && statusCode !== 204 && isApplicationJSON(contentType) && isEmptyJSON(body)) {
        statusCode = 404;
        const serviceDefinition = initContext(req);
        body = convertResponseError(notFoundErrorResponse(), headers, serviceDefinition, req);
      }
      if (body && !(headers["transfer-encoding"] || "").includes("chunked") && statusCode !== 204) {
        setContentLength(headers, body);
      } else {
        clearContentLength(headers);
      }
      respond(req, res, statusCode, headers, body);
    } catch (err) {
      // Error
      if (err.statusCode === 400) {
        logWarn(req, "Response", err);
      } else {
        logError(req, "Response", err);
      }
      if (proxyRes.body && proxyRes.body.error) {
        respond(
          req,
          res,
          proxyRes.statusCode,
          proxyRes.headers,
          convertResponseError(proxyRes.body, proxyRes.headers, undefined, req),
        );
      } else {
        if (res.writeHead && !res.headersSent) {
          res.writeHead(500);
        }
        if (!res.writableEnded) {
          res.end("Internal Server Error");
        }
      }
    }
  }

  async function processStreamResponse(proxyRes, req, res, headers) {
    // Trace
    traceResponse(req, "ProxyResponse", proxyRes.statusCode, proxyRes.statusMessage, headers, {});

    let streamRes = proxyRes;
    convertBasicHeaders(headers);
    const context = req.contexts && req.contexts[0];
    if (context && context.definition && context.definitionElements) {
      const mediaDataElementName = findElementByAnnotation(context.definitionElements, "@Core.MediaType");
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
          findElementByAnnotation(context.definitionElements, "@Core.IsURL") ||
          findElementByAnnotation(context.definitionElements, "@Core.IsUrl");
        if (urlElement) {
          const mediaResponse = await fetch(target + parts.join("/"), {
            method: "GET",
            headers: propagateHeaders(req, {
              accept: "application/json",
            }),
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
                  headers: propagateHeaders(req),
                });
                res.status(mediaResponse.status);
                headers = convertBasicHeaders(convertToNodeHeaders(mediaResponse.headers));
                streamRes = mediaResponse.body;
              } catch (err) {
                logError(req, "MediaStream", err);
                const headers = { "content-type": "application/json" };
                const errorBody = convertResponseError(
                  { error: { message: err.message } },
                  headers,
                  context.definition,
                  req,
                );
                respond(req, res, 500, headers, errorBody);
                return;
              }
            }
          }
        } else {
          if (!headers["content-disposition"] || calcContentDisposition) {
            // Is Binary
            const contentDispositionFilenameElement =
              findElementValueByAnnotation(context.definitionElements, "@Core.ContentDisposition.Filename") ||
              findElementValueByAnnotation(context.definitionElements, "@Common.ContentDisposition.Filename");
            if (contentDispositionFilenameElement) {
              const contentDispositionTypeValue =
                findElementValueByAnnotation(context.definitionElements, "@Core.ContentDisposition.Type") ||
                findElementValueByAnnotation(context.definitionElements, "@Common.ContentDisposition.Type") ||
                contentDisposition;
              const response = await fetch(target + [...parts, contentDispositionFilenameElement, "$value"].join("/"), {
                method: "GET",
                headers: propagateHeaders(req, {
                  accept: "application/json,*/*",
                }),
              });
              if (response.ok) {
                const filename = await response.text();
                if (filename) {
                  headers["content-disposition"] = `${contentDispositionTypeValue}; filename="${encodeURIComponent(
                    filename,
                  )}"`;
                }
              } else {
                logWarn(req, "ContentDisposition", await response.text());
              }
            }
          }
        }
      }
    }

    delete headers["content-encoding"];
    Object.entries(headers).forEach(([name, value]) => {
      res.setHeader(name, value);
    });
    pipeline(streamRes, res, (err) => {
      if (err) {
        logWarn(req, "StreamResponse", err);
      }
    });

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
      const elements = definitionElements(definition);
      convertLocation(body, headers, definition, elements, req);
    }
    convertMessages(body, headers, definition && definition.kind === "entity" ? definition : serviceDefinition, req);
    return headers;
  }

  function convertLocation(body, headers, definition, elements, req) {
    if (headers.location || headers.Location) {
      headers.location = entityUri(body, definition, elements, req);
    }
    delete headers.Location;
  }

  function convertToUnicode(string) {
    return string.replace(/[\u007F-\uFFFF]/g, (chr) => {
      const unicode = "0000" + chr.charCodeAt(0).toString(16);
      return "\\u" + unicode.substring(unicode.length - 4);
    });
  }

  function convertMessages(body, headers, definition, req) {
    if (headers["sap-messages"]) {
      let messages = JSON.parse(headers["sap-messages"]);
      if (messages && messages.length > 0) {
        if (req.context.messages === "transientOnly") {
          messages = messages.filter((message) => {
            return (
              !message.target ||
              message.target === MessageTargetTransient ||
              message.target.startsWith(MessageTargetTransientPrefix)
            );
          });
        }
        if (messages && messages.length > 0) {
          const rootMessage = messages.shift();
          rootMessage.details = Array.isArray(rootMessage.details) ? rootMessage.details : [];
          rootMessage.details.push(...messages);
          const message = convertMessage(rootMessage, definition, req);
          headers["sap-message"] = convertToUnicode(JSON.stringify(message));
        }
      }
      delete headers["sap-messages"];
    }
  }

  function convertMessage(message, definition, req, contentID) {
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
    contentID = message["@Core.ContentID"] || contentID;
    message.ContentID = contentID;
    delete message["@Core.ContentID"];
    if (Array.isArray(message.details)) {
      message.details = message.details.map((detail) => {
        return convertMessage(detail, definition, req, contentID);
      });
      if (propagateMessageToDetails) {
        const propagatedDetailMessage = Object.assign({}, message);
        delete propagatedDetailMessage.details;
        message.details.unshift(propagatedDetailMessage);
      }
      message.details.forEach((detail) => {
        if (detail.code && detail.code.toLowerCase().includes("transition")) {
          detail.transition = true;
        }
      });
    }
    return message;
  }

  function convertMessageTarget(messageTarget, req, definition) {
    if (!messageTarget) {
      return messageTarget;
    }
    if (messageTarget === MessageTargetTransient) {
      return messageTarget;
    }
    if (req.context.operation && req.context.boundDefinition) {
      const bindingParameterName = req.context.operation["@cds.odata.bindingparameter.name"] || "in";
      if (messageTarget.startsWith(`${bindingParameterName}/`)) {
        messageTarget = messageTarget.substring(bindingParameterName.length + 1);
      }
    }
    let transientTarget = false;
    if (messageTarget.startsWith(MessageTargetTransientPrefix)) {
      messageTarget = messageTarget.substring(MessageTargetTransientPrefix.length);
      transientTarget = true;
    }
    if (!/^[_a-z-0-9]*$/i.test(messageTarget)) {
      let context;
      if (definition && definition.kind === "entity") {
        context = definition;
      }
      if (!context && req.context.returnDefinition && req.context.returnDefinition.kind === "entity") {
        context = req.context.returnDefinition;
      }
      if (!context && req.lookupContext.returnDefinition && req.lookupContext.returnDefinition.kind === "entity") {
        context = req.lookupContext.returnDefinition;
      }
      let messageContext;
      if (
        contextFromUrl(
          {
            contextPath: messageTarget,
            query: {},
          },
          req,
          undefined,
          true,
        )
      ) {
        // Absolute target (no context)
        messageContext = undefined;
      } else if (
        contextFromUrl(
          {
            contextPath: messageTarget,
            query: {},
          },
          req,
          context,
          true,
        )
      ) {
        // Relative target (valid context)
        messageContext = context;
      } else {
        const rootContext = compositionRoot(context, req);
        if (
          context &&
          contextFromUrl(
            {
              contextPath: messageTarget,
              query: {},
            },
            req,
            rootContext,
            true,
          )
        ) {
          // Relative target (composition root context)
          messageContext = rootContext;
        }
      }
      messageTarget = convertMessageTargetParts(messageTarget, messageContext, req);
    }
    return (transientTarget ? MessageTargetTransientPrefix : "") + messageTarget;
  }

  function convertMessageTargetParts(messageTarget, context, req) {
    let stop = false;
    return messageTarget
      .split("/")
      .map((part) => {
        if (stop || !part) {
          return part;
        }
        let name = part;
        let keyPart = "";
        const keyStart = part.indexOf("(");
        const keyEnd = part.lastIndexOf(")");
        if (keyStart !== -1 && keyEnd === part.length - 1) {
          name = part.substring(0, keyStart);
          keyPart = part.substring(keyStart + 1, keyEnd);
        }
        context = lookupContext(name, context, req, "debug", messageTarget);
        if (!context) {
          stop = true;
        }
        const contextElements = definitionElements(context);
        const contextKeys = definitionKeys(context);
        if (context && keyPart) {
          const keys = keyPart.split(",");
          return `${name}(${keys
            .map((key) => {
              const [name, value] = key.split("=");
              let type;
              if (name && value) {
                if (context.params && context.params[name]) {
                  type = context.params[name].type;
                }
                if (!type) {
                  type = elementType(contextElements[name], req);
                }
                return `${name}=${replaceConvertDataTypeToV2(value, type, context)}`;
              } else if (name) {
                const key = Object.keys(contextKeys).find((key) => {
                  return contextKeys[key].type !== "cds.Composition" && contextKeys[key].type !== "cds.Association";
                });
                type = key && elementType(contextElements[key], req);
                return type && `${replaceConvertDataTypeToV2(name, type, context)}`;
              }
              return "";
            })
            .filter((part) => !!part)
            .join(",")})`;
        } else {
          return part;
        }
      })
      .join("/");
  }

  function convertResponseError(body, headers, definition, req) {
    if (!body) {
      if (req.context.serviceResponseAsXML) {
        headers["content-type"] = "application/xml;charset=utf-8";
      }
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
      body.error.innererror = body.error.innererror || {};
      body.error.innererror.errordetails = body.error.innererror.errordetails || [];
      body.error.innererror.errordetails.push(...(body.error.details || []));
      delete body.error.details;
      if (body.error.innererror.errordetails.length === 0) {
        const singleDetailError = Object.assign({}, body.error);
        delete singleDetailError.innererror;
        delete singleDetailError.details;
        if (body.error.innererror.errordetails.length === 0) {
          body.error.innererror.errordetails.push(singleDetailError);
        }
      }
    }
    if (typeof body === "object") {
      if (req.context.serviceResponseAsXML) {
        body = convertResponseBodyToXML(body, req);
        headers["content-type"] = "application/atom+xml;charset=utf-8";
      } else {
        body = JSON.stringify(body);
      }
    }
    body = `${body}`;
    setContentLength(headers, body);
    return body;
  }

  function convertResponseBody(proxyBody, headers, req) {
    let body = {
      d: {},
    };
    if (req.context.serviceRoot && proxyBody.value) {
      if (req.context.serviceRootAsXML) {
        return convertResponseServiceRootToXML(proxyBody, headers, req);
      } else {
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
        req.context.definitionElements = definitionElements(definition);
        const elements = req.context.definitionElements;
        const definitionElement = contextElementFromBody(proxyBody, req);
        if (definitionElement) {
          body.d[definitionElement.name] = convertDataTypeToV2(
            proxyBody.value,
            elementType(definitionElement, req),
            definition,
          );
          convertResponseElementData(body, headers, definition, elements, proxyBody, req);
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
          req.context.definitionElements = definitionElements(definition);
        }
        const data = convertResponseList(body, headers, definition, proxyBody, req);
        convertResponseData(data, headers, definition, proxyBody, req);
      }
    }

    if (req.context.operation) {
      let operationLocalName = localName(req.context.operation, req);
      if (req.context.boundDefinition) {
        operationLocalName = `${localName(req.context.boundDefinition, req)}_${operationLocalName}`;
      }
      const isArrayResult = Array.isArray(body.d.results) || Array.isArray(body.d);
      if (req.context.definition) {
        if (req.context.definition.kind === "type") {
          if (returnComplexNested && !isArrayResult) {
            body.d = {
              [operationLocalName]: body.d,
            };
            req.context.operationNested = true;
          }
        } else if (
          !req.context.definition.kind &&
          req.context.definition.name &&
          req.context.definitionElements.value
        ) {
          if (returnPrimitivePlain) {
            body.d = isArrayResult ? (body.d.results || body.d).map((entry) => entry.value) : body.d.value;
          }
          if (returnPrimitiveNested) {
            if (isArrayResult) {
              body.d = {
                results: body.d,
              };
            } else {
              body.d = {
                [operationLocalName]: body.d,
              };
              req.context.operationNested = true;
            }
          }
        }
      }
    }
    if (req.context.serviceResponseAsXML) {
      body = convertResponseBodyToXML(body, req);
      headers["content-type"] = "application/atom+xml;charset=utf-8";
      return body;
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
        if (req.context.parameters) {
          if (req.context.parameters.kind === "Parameters") {
            body.d = body.d.results[0];
            return body.d ? [body.d] : null;
          } else if (req.context.parameters.kind === "Set") {
            if (Object.keys(req.context.parameters.keys).length > 0) {
              body.d = body.d.results.filter((entry) => {
                return Object.keys(req.context.parameters.keys).every((key) => {
                  return entry[key] === req.context.parameters.keys[key];
                });
              })[0];
              return body.d ? [body.d] : null;
            }
          }
        }
        if (!returnCollectionNested) {
          body.d = body.d.results;
          return body.d;
        }
        return body.d.results;
      }
    }
    body.d = proxyBody;
    return [body.d];
  }

  function convertResponseData(data, headers, definition, proxyBody, req, selects) {
    if (data === null) {
      return;
    }
    if (!Array.isArray(data)) {
      return convertResponseData([data], headers, definition, proxyBody, req, selects);
    }
    if (!definition) {
      return;
    }
    selects = selects || req.context.selects || [];
    const elements = definitionElements(definition);
    // Recursion
    data.forEach((data) => {
      Object.keys(data).forEach((key) => {
        let element = elements[key];
        if (!element) {
          return;
        }
        const type = elementType(element, req);
        if (!type) {
          if (element.items) {
            const subSelects = determineSubSelects(element, selects);
            convertResponseData(data[key], headers, element.items, proxyBody, req, subSelects);
          } else if (element.elements) {
            const subSelects = determineSubSelects(element, selects);
            convertResponseData(data[key], headers, element, proxyBody, req, subSelects);
          }
        }
        if (type === "cds.Composition" || type === "cds.Association") {
          const subSelects = determineSubSelects(element, selects);
          convertResponseData(data[key], headers, element._target, proxyBody, req, subSelects);
        }
      });
    });
    // Structural Changes
    data.forEach((data) => {
      addResultsNesting(data, headers, definition, elements, proxyBody, req);
    });
    // Deferreds
    data.forEach((data) => {
      addDeferreds(data, headers, definition, elements, proxyBody, req, selects);
    });
    // Modify Payload
    data.forEach((data) => {
      addMetadata(data, headers, definition, elements, proxyBody, req);
      removeMetadata(data, headers, definition, elements, proxyBody, req);
      convertMedia(data, headers, definition, elements, proxyBody, req);
      removeAnnotations(data, headers, definition, elements, proxyBody, req);
      convertDataTypesToV2(data, headers, definition, elements, proxyBody, req);
      convertAggregation(data, headers, definition, elements, proxyBody, req);
      filterParameters(data, headers, definition, elements, proxyBody, req);
    });
  }

  function convertResponseElementData(data, headers, definition, elements, proxyBody, req) {
    if (!definition) {
      return;
    }
    // Modify Payload
    convertDataTypesToV2(data, headers, definition, elements, proxyBody, req);
  }

  function determineSubSelects(element, selects) {
    return selects.reduce((results, select) => {
      if (select.startsWith(`${element.name}/`)) {
        results.push(select.substring(element.name.length + 1));
      }
      return results;
    }, []);
  }

  function contextNameFromBody(body) {
    let context = body && (body["@odata.context"] || body["@context"]);
    if (!context) {
      return;
    }
    if (context === "$metadata") {
      return "";
    }
    const metadataIndex = context.indexOf("$metadata#");
    if (metadataIndex !== -1) {
      context = context.substring(metadataIndex + "$metadata#".length);
    }
    if (context.endsWith("/$entity")) {
      context = context.substring(0, context.length - "/$entity".length);
    }
    if (context.endsWith("/DraftAdministrativeData")) {
      return "DraftAdministrativeData";
    }
    if (context.startsWith("Collection(")) {
      context = context.substring("Collection(".length, context.indexOf(")"));
    } else {
      if (context.indexOf("(") !== -1) {
        context = context.substring(0, context.indexOf("("));
      }
    }
    if (context.indexOf("/") !== -1) {
      context = context.substring(0, context.indexOf("/"));
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
      const name = context.substring(context.lastIndexOf("/") + 1);
      if (name && !name.startsWith("$")) {
        const element = definitionElements(definition)[name];
        if (element) {
          return element;
        }
      }
    }
  }

  function addMetadata(data, headers, definition, elements, body, req) {
    const typeSuffix =
      definition.kind === "entity" && definition.params && req.context.parameters
        ? req.context.parameters.kind === "Set"
          ? "Type"
          : "Parameters"
        : "";
    data.__metadata = {};
    if (definition.name) {
      data.__metadata.type = qualifiedODataName(definition.name, req) + typeSuffix;
    }
    if (definition.kind === "entity") {
      data.__metadata.uri = entityUri(data, definition, elements, req);
      if (data["@odata.etag"] || data["@etag"]) {
        data.__metadata.etag = data["@odata.etag"] || data["@etag"];
      }
      const mediaDataElementName = findElementByAnnotation(elements, "@Core.MediaType");
      if (mediaDataElementName) {
        data.__metadata.media_src = `${data.__metadata.uri}/$value`;
        const mediaDataElement = elements[mediaDataElementName];
        const mediaTypeElementName =
          (mediaDataElement["@Core.MediaType"] && mediaDataElement["@Core.MediaType"]["="]) ||
          findElementByAnnotation(elements, "@Core.IsMediaType");
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

  function removeMetadata(data, headers, definition, elements, body, req) {
    Object.keys(data).forEach((key) => {
      if (key.startsWith("@") || key.startsWith("odata.") || key.includes("@odata.")) {
        delete data[key];
      }
    });
  }

  function convertMedia(data, headers, definition, elements, proxyBody, req) {
    Object.keys(data).forEach((key) => {
      if (key.endsWith("@odata.mediaReadLink")) {
        data[key.split("@odata.mediaReadLink")[0]] = data[key];
      } else if (key.endsWith("@mediaReadLink")) {
        data[key.split("@mediaReadLink")[0]] = data[key];
      }
    });
  }

  function removeAnnotations(data, headers, definition, elements, proxyBody, req) {
    Object.keys(data).forEach((key) => {
      if (key.startsWith("@")) {
        delete data[key];
      }
    });
  }

  function convertAggregation(data, headers, definition, elements, body, req) {
    if (!req.context.$apply) {
      return;
    }
    Object.keys(data).forEach((key) => {
      let value = data[key];
      if (key.startsWith(AggregationPrefix)) {
        if (!(key.endsWith("@odata.type") || key.endsWith("@type"))) {
          const name = key.substring(AggregationPrefix.length);
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
          } else if (["cds.String", "cds.LargeString"].includes(aggregationType)) {
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
          if (element && elementType(element, req) === "cds.Integer") {
            const aggregation =
              element["@Aggregation.default"] || element["@Aggregation.Default"] || element["@DefaultAggregation"];
            const aggregationName = aggregation ? aggregation["#"] || aggregation : DefaultAggregation;
            const aggregationFunction = aggregationName ? AggregationMap[aggregationName.toUpperCase()] : undefined;
            if (
              aggregationType === "cds.Decimal" &&
              aggregationFunction &&
              ![AggregationMap.AVG].includes(aggregationFunction)
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
        const type = elementType(keyElement, req);
        let value = data[keyElement.name];
        if (value !== undefined && value !== null) {
          value = encodeURIKey(value);
          if (DataTypeMap[type]) {
            value = convertDataTypeToV2Uri(String(value), type).replace(/(.*)/s, DataTypeMap[type].v2);
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
    if (req.context.$apply.search) {
      aggregationKey.search = encodeURIComponent(req.context.$apply.search);
    }
    data.ID__ = `aggregation'${JSON.stringify(aggregationKey)}'`;
    data.__metadata.uri = entityUriKey(data.ID__, definition, req);
    delete data.__metadata.etag;
  }

  function filterParameters(data, headers, definition, elements, body, req) {
    if (
      definition &&
      definition.kind === "entity" &&
      definition.params &&
      req.context.parameters &&
      req.context.parameters.kind === "Parameters"
    ) {
      const columns = definitionQueryColumns(definition);
      Object.keys(elements).forEach((name) => {
        const param = columns.find((column) => column.as === name);
        const paramName = (param ? param.ref.join("_") : "") || name;
        if (!definition.params[paramName]) {
          delete data[name];
        }
      });
    }
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
        value = DataTypeMap[type].v2.replace("$1", encodeReplaceValue(value));
      }
    }
    return value;
  }

  function convertDataTypesToV2(data, headers, definition, elements, body, req) {
    Object.keys(data).forEach((key) => {
      if (data[key] === null) {
        return;
      }
      const element = elements[key];
      if (!element) {
        return;
      }
      data[key] = convertDataTypeToV2(data[key], elementType(element, req), definition);
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
      value = `${value}T00:00:00`;
    } else if (["cds.Time"].includes(type)) {
      value = convertToDayTimeDuration(value);
    }
    return value;
  }

  function convertToDayTimeDuration(value) {
    const timeParts = value.split(":");
    return `PT${timeParts[0] || "00"}H${timeParts[1] || "00"}M${timeParts[2] || "00"}S`;
  }

  function addResultsNesting(data, headers, definition, elements, root, req) {
    if (!returnCollectionNested) {
      return;
    }
    Object.keys(data).forEach((key) => {
      const element = elements[key];
      if (!element) {
        return;
      }
      if (element.cardinality && element.cardinality.max === "*") {
        data[key] = {
          results: data[key],
        };
      }
    });
  }

  function addDeferreds(data, headers, definition, elements, root, req, selects) {
    if (definition.kind !== "entity" || req.context.$apply) {
      return;
    }
    selects = selects.map((select) => {
      return select.split("/")[0];
    });
    const _entityUri = entityUri(data, definition, elements, req);
    for (const key of Object.keys(elements)) {
      const element = elements[key];
      const type = elementType(element, req);
      if (element && (type === "cds.Composition" || type === "cds.Association")) {
        if (data[key] === undefined) {
          if (selects.length === 0 || selects.includes(key)) {
            if (fixDraftRequests && req.context.expandSiblingEntity && key === "SiblingEntity") {
              data[key] = null;
            } else {
              data[key] = {
                __deferred: {
                  uri: `${_entityUri}/${key}`,
                },
              };
            }
          }
        }
      }
    }
    if (definition.kind === "entity" && definition.params && req.context.parameters) {
      if (req.context.parameters.kind === "Parameters") {
        if (selects.length === 0 || selects.includes("Set")) {
          data.Set = {
            __deferred: {
              uri: `${_entityUri}/Set`,
            },
          };
        }
      } else if (req.context.parameters.kind === "Set") {
        if (selects.length === 0 || selects.includes("Parameters")) {
          data.Parameters = {
            __deferred: {
              uri: `${_entityUri}/Parameters`,
            },
          };
        }
      }
    }
  }

  function rootUri(req) {
    const protocol = (processForwardedHeaders && req.header("x-forwarded-proto")) || req.protocol || "http";
    const host =
      (processForwardedHeaders && req.header("x-forwarded-host")) ||
      req.headers.host ||
      `${req.hostname || DefaultHost}:${req.socket.address().port || DefaultPort}`;
    return `${protocol}://${host}`.replace(/^http:\/\/127.0.0.1/, `http://${DefaultHost}`);
  }

  function serviceUri(req) {
    if (req.context.serviceUri) {
      return req.context.serviceUri;
    }
    let serviceUri = rootUri(req);
    if (processForwardedHeaders && req.header("x-forwarded-path") !== undefined) {
      const path = stripSlashes(URL.parse(req.header("x-forwarded-path") || "").pathname || "");
      let resourceStartPath = "";
      const definition = req.context.requestDefinition;
      if (definition) {
        if (definition.kind === "entity") {
          resourceStartPath = localName(definition, req);
        } else if (definition.kind === "function" || definition.kind === "action") {
          resourceStartPath = localName(definition.parent || definition, req);
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
    } else {
      const endpointPath = `${sourcePath}/${sourceServicePath(req.servicePath)}`;
      serviceUri += (req.endpointRewrite && req.endpointRewrite(endpointPath)) || endpointPath;
    }
    req.context.serviceUri = serviceUri.endsWith("/") ? serviceUri : `${serviceUri}/`;
    return req.context.serviceUri;
  }

  function entityUriCollection(entity, req) {
    return `${serviceUri(req)}${localName(entity, req)}`;
  }

  function entityUriKey(key, entity, req) {
    return `${entityUriCollection(entity, req)}(${key})`;
  }

  function entityUri(data, entity, elements, req) {
    return entityUriKey(entityKey(data, entity, elements, req), entity, req);
  }

  function entityKey(data, entity, elements, req) {
    if (entity.kind === "entity" && entity.params && req.context.parameters) {
      return entityKeyParameters(data, entity, elements, req);
    }
    const keyElements = Object.keys(definitionKeys(entity)).reduce((keys, key) => {
      const element = elements[key];
      const type = elementType(element, req);
      if (!(type === "cds.Composition" || type === "cds.Association")) {
        keys.push(element);
      }
      return keys;
    }, []);
    return keyElements
      .map((keyElement) => {
        const type = elementType(keyElement, req);
        let value = data[keyElement.name];
        if (value !== undefined && value !== null) {
          value = encodeURIKey(value);
          if (DataTypeMap[type]) {
            value = convertDataTypeToV2Uri(String(value), type).replace(/(.*)/s, DataTypeMap[type].v2);
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

  function entityKeyParameters(data, entity, elements, req) {
    const keys = definitionKeys(entity);
    const keyElements = [];
    Object.keys(req.context.parameters.values).forEach((param) => {
      keyElements.push(entity.params[param]);
    });
    if (req.context.parameters.kind === "Set") {
      Object.keys(req.context.parameters.keys).forEach((key) => {
        keyElements.push(keys[key]);
      });
      const columns = definitionQueryColumns(entity);
      Object.keys(keys).forEach((key) => {
        const param = columns.find((column) => column.as === key);
        const paramName = (param ? param.ref.join("_") : "") || key;
        if (!keyElements.find((keyElement) => keyElement.name === paramName)) {
          keyElements.push(keys[key]);
        }
      });
    }
    data = { ...data, ...req.context.parameters.values, ...req.context.parameters.keys };
    return keyElements
      .map((keyElement) => {
        const type = elementType(keyElement, req);
        let value = data[keyElement.name];
        if (value !== undefined && value !== null) {
          value = encodeURIKey(value);
          if (DataTypeMap[type]) {
            value = convertDataTypeToV2Uri(String(value), type).replace(/(.*)/s, DataTypeMap[type].v2);
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

  function definitionQueryColumns(definition) {
    if (definition.query) {
      if (definition.query.SELECT && definition.query.SELECT.columns) {
        return definition.query.SELECT.columns;
      } else if (
        definition.query.SET &&
        definition.query.SET.args &&
        definition.query.SET.args[0] &&
        definition.query.SET.args[0].SELECT &&
        definition.query.SET.args[0].SELECT.columns
      ) {
        return definition.query.SET.args[0].SELECT.columns;
      }
    }
    return [];
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
        }),
      )
    );
  }

  function sourceServicePath(servicePath) {
    if (!targetPath) {
      return servicePath;
    }
    if (servicePath.startsWith(`/${targetPath}`)) {
      return servicePath.substring(targetPath.length + 1);
    }
    if (servicePath.startsWith(`${targetPath}/`)) {
      return servicePath.substring(targetPath.length + 1);
    }
    return servicePath;
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
        if (body.pipe) {
          pipeline(body, res, (err) => {
            if (err) {
              logWarn(req, "MetadataStream", err);
            }
          });
        } else {
          res.write(body);
          res.end();
        }
      } else {
        res.end();
      }

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

  function normalizeBody(body) {
    if (typeof body === "string" || Buffer.isBuffer(body)) {
      return body;
    }
    if (typeof body === "object") {
      return JSON.stringify(body);
    }
    return String(body);
  }

  function isEmptyJSON(content) {
    return !content || content === "{}";
  }

  function convertResponseServiceRootToXML(proxyBody, headers, req) {
    let xmlBody = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>`;
    xmlBody += `<service xml:base="${serviceUri(
      req,
    )}" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:app="http://www.w3.org/2007/app" xmlns="http://www.w3.org/2007/app">`;
    xmlBody += `<workspace><atom:title>Default</atom:title>`;
    xmlBody += proxyBody.value
      .map((entry) => {
        return `<collection href="${entry.name}"><atom:title>${entry.name}</atom:title></collection>`;
      })
      .join("");
    xmlBody += `</workspace></service>`;
    headers["content-type"] = "application/xml;charset=utf-8";
    return xmlBody;
  }

  function convertResponseBodyToXML(body, req) {
    let xmlBody = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>`;
    const namespace = ` xml:base="${serviceUri(
      req,
    )}" xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" xmlns="http://www.w3.org/2005/Atom"`;
    const definition = req.context.definition;
    if (body && body.d && definition) {
      xmlBody += convertResponseListToXML(body.d, definition, req, namespace);
    } else if (body && body.error) {
      xmlBody += convertResponseErrorToXML(body.error);
    } else {
      xmlBody += `<feed${namespace}></feed>`;
    }
    return xmlBody;
  }

  function convertResponseListToXML(data, definition, req, namespace, element) {
    let xmlBody = "";
    if (data) {
      if (data.results) {
        xmlBody += `<feed${namespace || ""}>`;
        xmlBody += `<title type="text">${localName(definition, req)}</title>`;
        xmlBody += `<id>${entityUriCollection(definition, req)}</id>`;
        xmlBody += `<updated>${req.now.toISOString()}</updated>`;
        xmlBody += `<link rel="self" title="${element || localName(definition, req)}" href="${entityUriCollection(
          definition,
          req,
        )}${element ? `/${element}` : ""}" />`;
        data.results.forEach((entry) => {
          if (typeof entry === "object") {
            xmlBody += convertResponseDataToXML(entry, definition, req);
          } else {
            xmlBody += `<entry><content>${entry}</content></entry>`;
          }
        });
        xmlBody += `</feed>`;
      } else {
        if (req.context.operationNested) {
          const operationName = Object.keys(data)[0];
          if (operationName) {
            data = data[operationName];
          }
        }
        xmlBody += convertResponseDataToXML(data, definition, req, namespace);
      }
    }
    return xmlBody;
  }

  function convertResponseDataToXML(data, definition, req, namespace) {
    let xmlBody = `<entry${namespace || ""}>`;
    const uri = data.__metadata && data.__metadata.uri;
    if (uri) {
      xmlBody += `<id>${uri}</id>`;
    }
    xmlBody += `<title type="text"></title>`;
    xmlBody += `<updated>${req.now.toISOString()}</updated>`;
    xmlBody += `<author><name /></author>`;
    if (uri) {
      xmlBody += `<link rel="edit" title="${localName(definition, req)}" href="${uri}" />`;
    }
    const elements = definitionElements(definition);
    if (typeof data === "object") {
      Object.keys(data).forEach((key) => {
        const value = data[key];
        const element = elements[key];
        const type = elementType(element, req);
        if (type === "cds.Composition" || type === "cds.Association") {
          if (value && value.__deferred) {
            xmlBody += `<link rel="http://schemas.microsoft.com/ado/2007/08/dataservices/related/${key}" type="application/atom+xml;type=entry" title="${key}" href="${uri}/${key}" />`;
          } else {
            xmlBody += `<link rel="http://schemas.microsoft.com/ado/2007/08/dataservices/related/${key}" type="application/atom+xml;type=entry" title="${key}" href="${uri}/${key}"><m:inline>`;
            xmlBody += convertResponseListToXML(value, element._target, req, "", element.name);
            xmlBody += `</m:inline></link>`;
          }
        }
      });
      xmlBody += `<category term="${definition.name}" scheme="http://schemas.microsoft.com/ado/2007/08/dataservices/scheme" />`;
      xmlBody += `<content type="application/xml"><m:properties>`;
      Object.keys(data).forEach((key) => {
        if (["__metadata"].includes(key)) {
          return;
        }
        const element = elements[key];
        const type = elementType(element, req);
        if (!(type === "cds.Composition" || type === "cds.Association")) {
          if (data[key] === null) {
            xmlBody += `<d:${key} m:null="true" />`;
          } else {
            let value = data[key];
            const match = typeof value === "string" && value.match(/\/Date\((.*)\)\//is);
            const date = match && match.pop();
            if (date) {
              value = new Date(parseInt(date.split("+")[0])).toISOString().slice(0, 19); // Cut millis
            }
            xmlBody += `<d:${key} m:type="${ODataType[type]}">${value}</d:${key}>`;
          }
        }
      });
      xmlBody += `</m:properties></content>`;
    } else {
      xmlBody += `<content type="text/plain">${data}</content>`;
    }
    xmlBody += `</entry>`;
    return xmlBody;
  }

  function convertResponseErrorToXML(error) {
    let xmlBody = `<error xmlns="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata">`;
    xmlBody += convertResponseErrorMessageToXML(error);
    xmlBody += `</error>`;
    return xmlBody;
  }

  function convertResponseErrorMessageToXML(message) {
    let xmlBody = `<code>${message.code}</code>`;
    xmlBody += `<severity>${message.severity}</severity>`;
    if (typeof message.message === "string") {
      xmlBody += `<message>${message.message}</message>`;
    } else {
      xmlBody += `<message xml:lang="${message.message.lang}">${message.message.value}</message>`;
    }
    if (message.additionalTargets) {
      xmlBody += `<additionalTargets>`;
      message.additionalTargets.forEach((additionalTarget) => {
        xmlBody += `<target>${additionalTarget}</target>`;
      });
      xmlBody += `</additionalTargets>`;
    }
    if (message.ContentID) {
      xmlBody += `<ContentID>${message.ContentID}</ContentID>`;
    }
    if (message.target) {
      xmlBody += `<target>${message.target}</target>`;
    }
    if (message.transition) {
      xmlBody += `<transition>${message.transition}</transition>`;
    }
    if (message.innererror && message.innererror.errordetails) {
      xmlBody += `<innererror><errordetails>`;
      message.innererror.errordetails.forEach((errorDetail) => {
        xmlBody += `<errordetail>`;
        xmlBody += convertResponseErrorMessageToXML(errorDetail);
        xmlBody += `</errordetail>`;
      });
      xmlBody += `</errordetails></innererror>`;
    }
    return xmlBody;
  }

  function notFoundErrorResponse() {
    return {
      error: {
        code: "404",
        message: "Not Found",
        severity: "error",
      },
    };
  }

  function propagateHeaders(req, addHeaders = {}) {
    const headers = Object.assign({}, req.headers, addHeaders);
    headers["x-request-id"] = req.contextId;
    headers["x-correlation-id"] = req.contextId;
    headers["x-correlationid"] = req.contextId;
    delete headers.host;
    delete headers.connection;
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
        contentType.startsWith("application/atom+xml") ||
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

  function encodeReplaceValue(value) {
    if (typeof value === "string") {
      return value.replace(/\$/g, "$$$$");
    }
    return value;
  }

  function targetUrl(url) {
    return url.replace(sourcePath, rewritePath);
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
    return {
      name: lookupODataType(returns && returns.type),
      elements: {
        value: returns,
      },
    };
  }

  function lookupODataType(type) {
    const odataType = Object.keys(DataTypeOData).find((key) => {
      return DataTypeOData[key] === type;
    });
    if (odataType && odataType.startsWith("_")) {
      return odataType.substring(1);
    }
    return odataType;
  }

  function definitionElements(definition) {
    if (definition && definition.elements) {
      if (cacheDefinitions) {
        if (definition.hasOwnProperty(cacheSymbol)) {
          return definition[cacheSymbol];
        }
      }
      // Collect keys of prototype hierarchy
      const keys = [];
      for (const key in definition.elements || {}) {
        keys.push(key);
      }
      const elements = Object.freeze(
        keys.reduce((elements, key) => {
          const element = definition.elements[key];
          if (element["@cds.api.ignore"]) {
            return elements;
          }
          elements[key] = element;
          if (
            (element.type === "cds.Composition" || element.type === "cds.Association") &&
            element.keys &&
            element._target
          ) {
            element.keys.forEach((key) => {
              const targetKey = key.ref[0];
              const foreignKey = `${element.name}_${targetKey}`;
              if (!elements[foreignKey]) {
                elements[foreignKey] = {
                  key: element.key,
                  type: element._target.elements[targetKey].type,
                  name: foreignKey,
                  parent: element.parent,
                  kind: element.kind,
                };
              }
            });
          }
          return elements;
        }, {}),
      );
      if (cacheDefinitions) {
        Object.defineProperty(definition, cacheSymbol, {
          value: elements,
          writable: false,
          configurable: true,
        });
      }
      return elements;
    }
    return {};
  }

  function definitionKeys(definition) {
    const elements = definitionElements(definition);
    return Object.keys(elements).reduce((keys, key) => {
      if (elements[key].key) {
        keys[key] = elements[key];
      }
      return keys;
    }, {});
  }

  function elementType(element, req) {
    let type;
    if (element) {
      type = element.type;
      if (element["@odata.Type"] || element["@odata.type"]) {
        const odataType = (element["@odata.Type"] || element["@odata.type"]).split(".").pop();
        if (odataType && DataTypeOData[odataType]) {
          type = DataTypeOData[odataType];
        }
      }
      if (!type && element.items && element.items.type) {
        type = element.items.type;
      }
    }
    return baseElementType(type, req.csn);
  }

  function baseElementType(type, csn) {
    if (type && csn.definitions[type]) {
      type = csn.definitions[type].type;
      type = baseElementType(type, csn);
    }
    return type;
  }

  function findElementByType(elements, type, req) {
    return Object.keys(elements)
      .filter((key) => {
        return !(elements[key].type === "cds.Composition" && elements[key].type === "cds.Association");
      })
      .find((key) => {
        const element = elements[key];
        return element && elementType(element, req) === type;
      });
  }

  function findElementByAnnotation(elements, annotation) {
    return Object.keys(elements)
      .filter((key) => {
        return !(elements[key].type === "cds.Composition" && elements[key].type === "cds.Association");
      })
      .find((key) => {
        const element = elements[key];
        return element && !!element[annotation];
      });
  }

  function findElementValueByAnnotation(elements, annotation) {
    const elementName = findElementByAnnotation(elements, annotation);
    if (elementName) {
      const elementValue = elements[elementName][annotation];
      if (elementValue) {
        return elementValue["="] || elementValue;
      }
    }
    return undefined;
  }

  function findEndingElementName(elements, url) {
    return Object.keys(elements)
      .filter((key) => {
        return !(elements[key].type === "cds.Composition" && elements[key].type === "cds.Association");
      })
      .find((key) => {
        const element = elements[key];
        return url.contextPath.endsWith(`/${element.name}`);
      });
  }

  function compositionRoot(entity, req) {
    if (!entity || entity.kind !== "entity") {
      return;
    }
    const parentEntity = compositionParent(entity, req);
    return parentEntity ? compositionRoot(parentEntity, req) : entity;
  }

  function compositionParent(entity, req) {
    if (!entity || entity.kind !== "entity") {
      return;
    }
    const parentAssociation = compositionParentAssociation(entity, req);
    return parentAssociation ? parentAssociation._target : null;
  }

  function compositionParentAssociation(entity, req) {
    if (!entity || entity.kind !== "entity") {
      return;
    }
    const elements = definitionElements(entity);
    const parentAssociation = Object.keys(elements).find((name) => {
      const element = elements[name];
      if (element.type === "cds.Association") {
        const parentDefinition = req.csn.definitions[element.target];
        const parentElements = definitionElements(parentDefinition);
        return !!Object.keys(parentElements).find((name) => {
          const parentElement = parentElements[name];
          if (parentElement.type === "cds.Composition") {
            return parentElement.target === entity.name;
          }
        });
      }
    });
    if (parentAssociation) {
      return elements[parentAssociation];
    }
    if (entity.name.endsWith(".texts")) {
      const parentEntityName = Object.keys(req.csn.definitions).find((name) => {
        const definition = req.csn.definitions[name];
        if (definition.kind !== "entity") {
          return false;
        }
        const elements = definitionElements(definition);
        return !!Object.keys(elements).find((name) => {
          const parentElement = elements[name];
          if (parentElement.type === "cds.Composition") {
            return parentElement.target === entity.name;
          }
        });
      });
      if (parentEntityName) {
        return {
          target: parentEntityName,
          _target: req.csn.definitions[parentEntityName],
        };
      }
    }
  }

  function determineLocale(req) {
    let locale = cds.env.i18n && cds.env.i18n.default_language;
    try {
      locale = require("@sap/cds/lib/req/locale")(req);
    } catch {
      try {
        // CDS 3
        // eslint-disable-next-line n/no-missing-require
        locale = require("@sap/cds-runtime/lib/cds-services/adapter/utils/locale")({ req });
      } catch {
        // Default
      }
    }
    if (locale && locale.length >= 2) {
      locale = locale.substring(0, 2).toLowerCase() + locale.slice(2);
    }
    return locale || "en";
  }

  const ensureArray = (value) => {
    if (!value) {
      return [];
    }
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === "string") {
      return value.split(",");
    }
    if (typeof value === "object") {
      return Object.keys(value)
        .filter((k) => value[k])
        .sort();
    }
    return [];
  };

  function decodeBase64(b64String) {
    return Buffer.from(b64String, "base64").toString();
  }

  function decodeJwtTokenBody(token) {
    const parts = token.split(".");
    if (parts.length > 1) {
      return JSON.parse(decodeBase64(parts[1]));
    }
    throw new Error("Invalid JWT token");
  }

  function setContentLength(headers, body) {
    if (body && body.length && !(headers["transfer-encoding"] || "").includes("chunked")) {
      headers["content-length"] = Buffer.byteLength(body);
    } else {
      clearContentLength(headers);
    }
  }

  function clearContentLength(headers) {
    delete headers["content-length"];
  }

  function processMultipartMixed(
    req,
    multiPartBody,
    contentType,
    urlProcessor,
    bodyHeadersProcessor,
    contentIdOrder = [],
    direction,
  ) {
    let maxContentId = 1;

    function nextContentID() {
      return "cov2ap_" + String(maxContentId++);
    }

    if (!multiPartBody || !(typeof multiPartBody === "string")) {
      const error = new Error("Invalid multipart body");
      error.statusCode = 400;
      throw error;
    }

    if (!contentType || !(typeof contentType === "string")) {
      const error = new Error("Invalid content type");
      error.statusCode = 400;
      throw error;
    }

    const match = contentType.replace(/\s/g, "").match(/^multipart\/mixed;boundary=([^;]*)/i);
    let boundary = match && match.pop();
    if (!boundary) {
      return multiPartBody;
    }
    let boundaryChangeSet = "";
    let urlAfterBlank = false;
    let bodyAfterBlank = false;
    let previousLineIsBlank = false;
    let index = 0;
    let httpInfo;
    let statusCode;
    let statusCodeText;
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
              statusCode = (result && result.statusCode) || statusCode;
              statusCodeText = (result && result.statusCodeText) || statusCodeText;
              body = (result && result.body) ?? body;
              headers = (result && result.headers) || headers;
              if (["HEAD", "OPTIONS", "GET", "DELETE"].includes(method)) {
                body = "";
              }
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
          if (httpInfo && statusCode) {
            newParts.splice(-1, 0, `${httpInfo[1]} ${statusCode} ${statusCodeText || httpInfo[3]}`);
          }
          Object.entries(headers).forEach(([name, value]) => {
            newParts.splice(-1, 0, `${name}: ${value}`);
          });
          newParts.push(body);
          httpInfo = undefined;
          statusCode = undefined;
          statusCodeText = undefined;
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

        if (part.startsWith("HTTP/")) {
          httpInfo = part.match(/^(HTTP\/[\d.]+)\s+(\d{3})\s(.*)$/i);
          if (httpInfo && httpInfo.length === 4) {
            statusCode = parseInt(httpInfo[2]);
          } else {
            httpInfo = undefined;
          }
        }
        if (!statusCode) {
          newParts.push(part);
        }
      } else if (bodyAfterBlank && (previousLineIsBlank || body !== "")) {
        body = body ? `${body}\r\n${part}` : part;
      } else if (part !== "") {
        const partIsContentId = part.toLowerCase().startsWith("content-id:");
        if (partIsContentId) {
          const colonIndex = part.indexOf(":");
          if (colonIndex !== -1) {
            contentId = part.substring(colonIndex + 1).trim();
            contentIdMisplaced = !!bodyAfterBlank;
          }
        }
        const partContentTransferEncoding = part.toLowerCase().startsWith("content-transfer-encoding:");
        if (partContentTransferEncoding && !bodyAfterBlank) {
          const colonIndex = part.indexOf(":");
          if (colonIndex !== -1) {
            contentTransferEncoding = part.substring(colonIndex + 1).trim();
          }
        }
        if (!bodyAfterBlank) {
          if (!(direction === ProcessingDirection.Response && partIsContentId && contentId.startsWith("cov2ap_"))) {
            newParts.push(part);
          }
        } else {
          let colonIndex = part.indexOf(":");
          if (colonIndex !== -1) {
            headers[part.substring(0, colonIndex).toLowerCase()] = part.substring(colonIndex + 1).trim();
          }
        }
      } else {
        newParts.push(part);
      }
      previousLineIsBlank = part === "";
    });
    return newParts.join("\r\n");
  }

  const sanitizeHeaders = (headers) => {
    headers = { ...(headers || {}) };
    if (headers.authorization) {
      headers.authorization = headers.authorization.split(" ")[0] + " ***";
    }
    return headers;
  };

  function traceRequest(req, name, method, url, headers, body) {
    const LOG = cds.log("cov2ap");
    if (LOG._debug) {
      const _url = decodeURIComponent(url) || "";
      const _headers = JSON.stringify(sanitizeHeaders(headers));
      const _body = typeof body === "string" ? body : body ? JSON.stringify(body) : "";
      logTrace(req, name, `${method} ${_url}`, _headers && "Headers:", _headers, _body && "Body:", _body);
    }
  }

  function traceResponse(req, name, statusCode, statusMessage, headers, body) {
    const LOG = cds.log("cov2ap");
    if (LOG._debug) {
      const _headers = JSON.stringify(sanitizeHeaders(headers));
      const _body = typeof body === "string" ? body : body ? JSON.stringify(body) : "";
      logTrace(
        req,
        name,
        `${statusCode || ""} ${statusMessage || ""}`,
        _headers && "Headers:",
        _headers,
        _body && "Body:",
        _body,
      );
    }
  }

  function logError(req, name, error) {
    const LOG = cds.log("cov2ap");
    if (LOG._error) {
      initCDSContext(req);
      LOG.error(`${name}:`, error);
    }
  }

  function logWarn(req, name, message, info) {
    const LOG = cds.log("cov2ap");
    if (LOG._warn) {
      initCDSContext(req);
      LOG.warn(`${name}:`, message, info);
    }
  }

  function logInfo(req, name, message, info) {
    const LOG = cds.log("cov2ap");
    if (LOG._info) {
      initCDSContext(req);
      LOG.info(`${name}:`, message, info);
    }
  }

  function logDebug(req, name, message, info) {
    const LOG = cds.log("cov2ap");
    if (LOG._debug) {
      initCDSContext(req);
      LOG.debug(`${name}:`, message, info);
    }
  }

  function logTrace(req, name, ...lines) {
    const LOG = cds.log("cov2ap");
    if (LOG._debug) {
      initCDSContext(req);
      LOG.debug(`${name}:`, lines.filter((line) => !!line).join("\n"));
    }
  }

  function log(req, level, name, message, info) {
    let error;
    switch (level.toLocaleString()) {
      case "error":
        error = new Error(message);
        error.info = info;
        logError(req, name, error);
        break;
      case "warn":
        logWarn(req, name, message, info);
        break;
      case "info":
        logInfo(req, name, message, info);
        break;
      case "debug":
        logDebug(req, name, message, info);
        break;
      case "trace":
        logTrace(req, name, message, info);
        break;
      default:
        return;
    }
  }

  function initCDSContext(req) {
    if (cds.context) {
      return;
    }
    cds.context = new cds.EventContext({
      id: req.contextId,
      user: req.user,
      tenant: req.tenant,
      http: { req, res: req.res },
    });
  }

  return router;
}

cov2ap.singleton = () => {
  if (!cov2ap._singleton) {
    cov2ap._singleton = cov2ap();
    cds.cov2ap = cov2ap._singleton;
  }
  return cov2ap._singleton;
};

module.exports = cov2ap;
