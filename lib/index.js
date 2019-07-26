"use strict";

// OData v2/v4 Delta: http://docs.oasis-open.org/odata/new-in-odata/v4.0/cn01/new-in-odata-v4.0-cn01.html

const URL = require("url");
const express = require("express");
const axios = require("axios");
const bodyparser = require("body-parser");
const proxy = require("http-proxy-middleware");
const cds = require("@sap/cds");
const logging = require("@sap/logging");
const { promisify } = require("util");

const SeverityMap = {
  1: "success",
  2: "info",
  3: "warning",
  4: "error"
};

const UUIDRegex = /(guid'[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}')/gi;

const DataTypeMap = {
  "cds.UUID": {
    v2: `guid'$1'`,
    v4: /guid'([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})'/gi
  },
  "cds.Binary": { v2: `binary'$1'`, v4: /X'(?:[0-9a-f][0-9a-f])+?'/gi },
  "cds.LargeBinary": { v2: `binary'$1'`, v4: /X'(?:[0-9a-f][0-9a-f])+?'/gi },
  "cds.Time": { v2: `time'$1'`, v4: /time'(.+?)'/gi },
  "cds.Date": { v2: `datetime'$1'`, v4: /datetime'(.+?)'/gi },
  "cds.DateTime": { v2: `datetimeoffset'$1'`, v4: /datetimeoffset'(.+?)'/gi },
  "cds.Timestamp": { v2: `datetimeoffset'$1'`, v4: /datetimeoffset'(.+?)'/gi },
  "cds.Double": { v2: `$1d`, v4: /[-]?[0-9]+?\.[0-9]+?(?:E[+-]?[0-9]+?)?d/gi },
  "cds.Decimal": { v2: `$1m`, v4: /([-]?[0-9]+?\.[0-9]+?)m/gi },
  "cds.DecimalFloat": { v2: `$1f`, v4: /([-]?[0-9]+?\.[0-9]+?)f/gi },
  "cds.Integer64": { v2: `$1L`, v4: /([-]?[0-9]+?)L/gi },
  "cds.String": { v2: `'$1'`, v4: /(.*)/gi }
};

const AggregationMap = {
  SUM: "sum",
  MIN: "min",
  MAX: "max",
  AVG: "average",
  COUNT: "countdistinct",
  COUNT_DISTINCT: "countdistinct"
};

const DefaultTenant = "00000000-0000-0000-0000-000000000000";
const AggregationPrefix = "__AGGREGATION__";

/**
 * Instantiates an CDS OData v2 Adapter Proxy Express Router for a CDS based OData v4 Server.
 * @param options CDS OData v2 Adapter Proxy options.
 * @param [options.base] Base path, under which the service is reachable. Default is ''.
 * @param [options.path] Path, under which the proxy is reachable. Default is 'v2'.
 * @param [options.model] CDS service model path. Default is 'all'.
 * @param [options.port] Target port, which points to OData v4 backend port. Default is '4004'.
 * @param [options.target] Target, which points to OData v4 backend host/port. Default is 'http://localhost:4004'.
 * @param [options.services] Service mapping, from url path name to service name. If omitted CDS defaults apply.
 * @param [options.standalone] Indication, that OData v2 Adapter proxy is a standalone process. Default is 'false'.
 * @param [options.mtxEndpoint] Endpoint to retrieve MTX metadata. Default is '/mtx/v1'
 * @returns {Router}
 */
module.exports = (options = undefined) => {
  const proxyCache = {};
  const appContext = logging.createAppContext();
  const router = express.Router();
  const base = (options && options.base) || "";
  const path = (options && options.path) || "v2";
  const sourcePath = `${base ? "/" + base : ""}/${path}`;
  const targetPath = base ? "/" + base : "";
  const pathRewrite = { [`^${sourcePath}`]: targetPath };
  const port = (options && options.port) || "4004";
  const target = (options && options.target) || `http://localhost:${port}`;
  const services = (options && options.services) || {};
  const standalone = (options && options.standalone) || false;
  const mtxEndpoint = (options && options.mtxEndpoint) || "/mtx/v1";

  let model = (options && options.model) || "all";
  if (model === "all" || (Array.isArray(model) && model[0] === "all")) {
    model = [cds.env.folders.app, cds.env.folders.srv, "services", "."].find(m => cds.resolve(m));
  }

  if (cds.env.mtx && cds.mtx) {
    cds.mtx.eventEmitter.on(cds.mtx.events.TENANT_UPDATED, tenantId => {
      delete proxyCache[tenantId];
    });
  }

  router.use(`/${path}/*`, logging.middleware({ appContext: appContext, logNetwork: true }));

  router.get(`/${path}/*/\\$metadata`, async (req, res) => {
    try {
      const { csn } = await getMetadata(req);
      req.csn = csn;
      const service = serviceFromRequest(req);
      const { edmx } = await getMetadata(req, service.name);
      res.setHeader("content-type", "application/xml");
      res.send(edmx);
    } catch (err) {
      // Error
      trace(req, "Error", err.toString());
      res.status(500).send("Internal Server Error");
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

      if (contentType.startsWith("application/json")) {
        bodyparser.json()(req, res, next);
      } else if (contentType.startsWith("multipart/mixed")) {
        bodyparser.text({ type: "multipart/mixed" })(req, res, next);
      } else {
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
        trace(req, "Error", err.toString());
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
      next();
    },

    // Proxy Middleware
    proxy({
      target,
      changeOrigin: true,
      selfHandleResponse: true,
      pathRewrite,
      onProxyReq: (proxyReq, req, res) => {
        convertProxyRequest(proxyReq, req, res);
      },
      onProxyRes: (proxyRes, req, res) => {
        convertProxyResponse(proxyRes, req, res);
      }
    })
  );

  function serviceFromRequest(req) {
    const requestPath = req.params["0"];
    const normalizedRequestPath = requestPath.replace(/^\/?(.*)\/?$/g, "$1");

    let servicePath;
    let service = Object.keys(req.csn.definitions).find(definitionName => {
      const definition = req.csn.definitions[definitionName];
      if (definition && definition.kind === "service" && definition["@path"]) {
        const normalizedDefinitionPath = definition["@path"].replace(/\/?(.*)\/?/g, "$1");
        if (
          normalizedRequestPath === normalizedDefinitionPath ||
          normalizedRequestPath.startsWith(`${normalizedDefinitionPath}/`)
        ) {
          servicePath = normalizedDefinitionPath;
          return true;
        }
      }
      return false;
    });
    if (!service) {
      Object.keys(services).find(configServicePath => {
        const normalizedConfigServicePath = configServicePath.replace(/\/?(.*)\/?/g, "$1");
        if (
          normalizedRequestPath === normalizedConfigServicePath ||
          normalizedRequestPath.startsWith(`${normalizedConfigServicePath}/`)
        ) {
          service = services[configServicePath];
          servicePath = normalizedConfigServicePath;
          return true;
        }
        return false;
      });
    }
    if (!service) {
      service = requestPath.charAt(0).toUpperCase() + requestPath.slice(1) + "Service";
      servicePath = requestPath;
    }
    return {
      name: service,
      path: servicePath
    };
  }

  async function getMetadata(req, service) {
    let metadata;
    if (standalone && mtxEndpoint) {
      metadata = await getTenantMetadataRemote(req, service);
    } else if (cds.env.mtx && cds.mtx) {
      metadata = await getTenantMetadataLocal(req, service);
    }
    if (!metadata) {
      metadata = await getDefaultMetadata(req, service);
    }
    return metadata;
  }

  async function getTenantId(req) {
    if (cds.env.requires && cds.env.requires.xsuaa && req.headers.authorization) {
      const xssec = require("@sap/xssec");
      const jwtToken = req.headers.authorization.substr("bearer ".length);
      const securityContext = await promisify(xssec.createSecurityContext)(
        jwtToken,
        cds.env.requires.xsuaa.credentials
      );
      return securityContext.getSubaccountId();
    }
  }

  async function getTenantMetadataRemote(req, service) {
    const tenantId = await getTenantId(req);
    if (tenantId) {
      return await compileService(
        tenantId,
        async () => {
          const response = await axios.get(getBaseUrl(req) + mtxEndpoint + `/metadata/csn/${tenantId}`, {
            headers: req.headers
          });
          return response && response.data;
        },
        service
      );
    }
  }

  async function getTenantMetadataLocal(req, service) {
    const tenantId = await getTenantId(req);
    if (tenantId && (await cds.mtx.isExtended(tenantId))) {
      return await compileService(
        tenantId,
        async () => {
          return await cds.mtx.getCsn(tenantId);
        },
        service
      );
    }
  }

  async function getDefaultMetadata(req, service) {
    return await compileService(
      DefaultTenant,
      async () => {
        return await cds.load(model);
      },
      service
    );
  }

  async function compileService(tenantId, loadCsn, service) {
    if (!proxyCache[tenantId]) {
      const csnRaw = await loadCsn();
      const csn = cds.linked(cds.compile.for.odata(csnRaw));
      proxyCache[tenantId] = {
        csnRaw,
        csn,
        edmx: {}
      };
    }
    if (service) {
      if (!proxyCache[tenantId].edmx[service]) {
        proxyCache[tenantId].edmx[service] = await cds.compile.to.edmx(proxyCache[tenantId].csnRaw, {
          service,
          version: "v2"
        });
      }
    }
    return {
      csn: proxyCache[tenantId].csn,
      edmx: service && proxyCache[tenantId].edmx[service]
    };
  }

  function lookupDefinition(name, req) {
    const definitionName = name.startsWith(`${req.service}.`) ? name : `${req.service}.${name}`;
    return req.csn.definitions[definitionName];
  }

  function lookupBoundDefinition(name, req) {
    let boundAction;
    Object.keys(req.csn.definitions).find(definitionName => {
      const definition = req.csn.definitions[definitionName];
      return Object.keys(definition.actions || {}).find(actionName => {
        if (name.endsWith(`_${actionName}`)) {
          const entityName = name.substr(0, name.length - `_${actionName}`.length);
          const entityDefinition = lookupDefinition(entityName, req);
          if (entityDefinition === definition) {
            boundAction = definition.actions[actionName];
            boundAction.name = actionName;
            boundAction.parent = definition;
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
    traceRequest(req, "Request", req.method, proxyReq.path, req.body);

    let body = req.body;
    const contentType = req.header("content-type");

    if (isMultipart(contentType)) {
      // Multipart
      body = processMultipart(
        req,
        req.body,
        contentType,
        ({ method, url, contentId }) => {
          return {
            method: method === "MERGE" ? "PATCH" : method,
            url: convertUrl(url, contentId, req)
          };
        },
        ({ contentType, body, headers, url }) => {
          delete headers.dataserviceversion;
          delete headers.maxdataserviceversion;
          if (contentType === "application/json") {
            body = convertRequestBody(body, headers, url, req);
          }
          return { body, headers };
        }
      );
    } else {
      // Single
      proxyReq.path = convertUrl(proxyReq.path, undefined, req);
      if (contentType === "application/json") {
        body = convertRequestBody(req.body, req.headers, proxyReq.path, req);
      }
    }

    if (req.body) {
      delete req.body;
    }
    if (contentType) {
      proxyReq.setHeader("content-length", Buffer.byteLength(body));
      proxyReq.write(body);
    }
    proxyReq.method = proxyReq.method === "MERGE" ? "PATCH" : proxyReq.method;
    proxyReq.end();

    // Trace
    traceRequest(req, "Proxy Request", proxyReq.method, proxyReq.path, body);
  }

  function convertUrl(urlPath, contentId, req) {
    let url = parseURL(urlPath, req);
    const definition = contextFromUrl(url, req);
    enrichRequest(definition, url, contentId, req);

    // Order is important
    convertUrlDataTypes(url, req);
    convertUrlCount(url, req);
    convertDraft(url, req);
    convertActionFunction(url, req);
    convertExpandSelect(url, req);
    convertFilter(url, req);
    convertAnalytics(url, req);
    convertValue(url, req);

    delete url.search;
    url.pathname = url.basePath + url.servicePath + url.contextPath;
    url.pathname = encodeURI(url.pathname);
    return URL.format(url);
  }

  function parseURL(urlPath, req) {
    const url = URL.parse(decodeURI(urlPath), true);
    url.pathname = decodeURI(url.pathname);
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
    // Normalize query parameters (no array)
    Object.keys(url.query || {}).forEach(name => {
      if (Array.isArray(url.query[name])) {
        url.query[name] = url.query[name][0] || "";
      }
    });
    return url;
  }

  function contextFromUrl(url, req) {
    let stop = false;
    return url.contextPath.split("/").reduce((context, part) => {
      if (stop) {
        return context;
      }
      const keyStart = part.indexOf("(");
      if (keyStart !== -1) {
        part = part.substr(0, keyStart);
      }
      context = lookupContext(part, context, req);
      if (!context) {
        stop = true;
      }
      return context;
    }, undefined);
  }

  function lookupContext(name, context, req) {
    if (!name) {
      return context;
    }
    if (!context) {
      if (name.startsWith("$") && req.contentId[name]) {
        return contextFromUrl(req.contentId[name], req);
      } else {
        context = lookupDefinition(name, req);
        if (!context) {
          context = lookupBoundDefinition(name, req);
        }
        if (!context) {
          trace(req, "Context", `Definition '${name}' not found`);
        }
        return context;
      }
    } else {
      if (name.startsWith("$")) {
        return context;
      }
      if (context.kind === "function" || context.kind === "action") {
        req.context.operation = context;
        const returns = (context.returns && context.returns.items && context.returns.items) || context.returns;
        context = lookupDefinition(returns.type, req);
      }
      const element = context && context.elements && context.elements[name];
      if (element) {
        if (element.type === "cds.Composition" || element.type === "cds.Association") {
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
      trace(req, "Context", `Definition '${name}' not found`);
    }
  }

  function enrichRequest(definition, url, contentId, req) {
    req.context = {
      url: url,
      serviceRoot: url.contextPath.length === 0,
      definition: definition,
      operation: null,
      bodyParameters: {},
      $value: false,
      $apply: null,
      aggregationKey: false
    };
    req.contexts.push(req.context);
    if (contentId) {
      req.contentId[`$${contentId}`] = url;
    }
  }

  function convertUrlDataTypes(url, req) {
    // Keys & Parameters
    let context;
    let stop = false;
    url.contextPath = url.contextPath
      .split("/")
      .map(part => {
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
        keyPart = decodeURIKey(keyPart);
        context = lookupContext(part, context, req);
        if (!context) {
          stop = true;
        }
        if (context && context.elements && keyPart) {
          let aggregationMatch = keyPart.match(/^aggregation'(.*)'$/i);
          let aggregationKey = aggregationMatch && aggregationMatch.pop();
          if (aggregationKey) {
            // Aggregation Key
            try {
              const aggregation = JSON.parse(aggregationKey);
              url.query["$select"] = Object.keys(aggregation.key)
                .concat(aggregation.value)
                .join(",");
              url.query["$filter"] = Object.keys(aggregation.key)
                .map(name => {
                  return `${name} eq ${aggregation.key[name]}`;
                })
                .join(" and ");
              req.context.aggregationKey = true;
              return part;
            } catch (err) {
              // Error
              trace(req, "Error", err.toString());
            }
          } else {
            const keys = keyPart.split(",");
            return `${part}(${keys.map(key => {
              const [name, value] = key.split("=");
              let type;
              if (name && value) {
                if (context.params && context.params[name]) {
                  type = context.params[name].type;
                }
                if (!type) {
                  type = context.elements[name] && context.elements[name].type;
                }
                return `${name}=${DataTypeMap[type] ? value.replace(DataTypeMap[type].v4, "$1") : value}`;
              } else if (name && context.keys) {
                const key = Object.keys(context.keys).find(key => {
                  return context.keys[key].type !== "cds.Composition" && context.keys[key].type !== "cds.Association";
                });
                type = key && context.elements[key] && context.elements[key].type;
                return type && `${DataTypeMap[type] ? name.replace(DataTypeMap[type].v4, "$1") : name}`;
              }
            })})`;
          }
        } else {
          return part;
        }
      })
      .join("/");

    // Query
    Object.keys(url.query).forEach(name => {
      if (name === "$filter") {
        url.query[name] = url.query[name]
          .split(UUIDRegex)
          .map((part, index) => {
            if (index % 2 === 0) {
              Object.keys(DataTypeMap).forEach(type => {
                part = part.replace(DataTypeMap[type].v4, "$1");
              });
              return part;
            } else {
              return part.replace(DataTypeMap["cds.UUID"].v4, "$1");
            }
          })
          .join("");
      } else if (!name.startsWith("$")) {
        if (context && context.elements && context.elements[name]) {
          const element = context.elements[name];
          if (DataTypeMap[element.type]) {
            url.query[name] = url.query[name].replace(DataTypeMap[element.type].v4, "$1");
          }
        }
        if (context && (context.kind === "function" || context.kind === "action")) {
          if (context.params && context.params[name]) {
            const element = context.params[name];
            if (DataTypeMap[element.type]) {
              url.query[name] = url.query[name].replace(DataTypeMap[element.type].v4, "$1");
            }
          }
          if (context.parent && context.parent.kind === "entity") {
            if (context.parent && context.parent.elements && context.parent.elements[name]) {
              const element = context.parent.elements[name];
              if (DataTypeMap[element.type]) {
                url.query[name] = url.query[name].replace(DataTypeMap[element.type].v4, "$1");
              }
            }
          }
        }
      }
    });
  }

  function convertUrlCount(url, req) {
    if (url.query["$inlinecount"]) {
      url.query["$count"] = url.query["$inlinecount"] === "allpages";
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
    const operationLocalName = definition.name.split(".").pop();
    let reqContextPathSuffix = "";
    if (url.contextPath.startsWith(operationLocalName)) {
      reqContextPathSuffix = url.contextPath.substr(operationLocalName.length);
      url.contextPath = url.contextPath.substr(0, operationLocalName.length);
    }
    // Key Parameters
    if (definition.parent && definition.parent.kind === "entity") {
      url.contextPath = definition.parent.name.split(".").pop();
      url.contextPath += `(${Object.keys(definition.parent.keys)
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
              const value = url.query[name] || "";
              result.push(`${name}=${quoteParameter(element, value, req)}`);
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
      Object.keys(url.query).forEach(name => {
        if (!name.startsWith("$")) {
          const element = definition.params && definition.params[name];
          let value = url.query[name] || "";
          value = unquoteParameter(element, value, req);
          value = parseParameter(element, value, req);
          url.query[name] = value;
        }
      });
      req.context.bodyParameters = url.query || {};
      url.query = {};
    }
  }

  function quoteParameter(element, value, req) {
    if (
      !element ||
      ["cds.Date", "cds.Time", "cds.DateTime", "cds.Timestamp", "cds.String", "cds.LargeString"].includes(element.type)
    ) {
      return `'${value.replace(/^["'](.*)["']$/, "$1")}'`;
    }
    return value;
  }

  function unquoteParameter(element, value, req) {
    if (
      !element ||
      ["cds.Date", "cds.Time", "cds.DateTime", "cds.Timestamp", "cds.String", "cds.LargeString"].includes(element.type)
    ) {
      return value.replace(/^["'](.*)["']$/, "$1");
    }
    return value;
  }

  function parseParameter(element, value, req) {
    if (element) {
      if (["cds.Boolean"].includes(element.type)) {
        return value === "true";
      } else if (["cds.Integer"].includes(element.type)) {
        return parseInt(value);
      }
    }
    return value;
  }

  function convertExpandSelect(url, req) {
    const definition = req.context && req.context.definition;
    if (definition) {
      const context = { select: {}, expand: {} };
      if (url.query["$expand"]) {
        const expands = url.query["$expand"].split(",");
        expands.forEach(expand => {
          let current = context.expand;
          expand.split("/").forEach(part => {
            current[part] = current[part] || { select: {}, expand: {} };
            current = current[part].expand;
          });
        });
      }
      if (url.query["$select"]) {
        const selects = url.query["$select"].split(",");
        selects.forEach(select => {
          let current = context;
          let currentDefinition = definition;
          select.split("/").forEach(part => {
            if (!current) {
              return;
            }
            const element = currentDefinition.elements && currentDefinition.elements[part];
            if (element) {
              if (element.type === "cds.Composition" || element.type === "cds.Association") {
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
        const serializeExpand = expand => {
          return Object.keys(expand || {})
            .map(name => {
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
    if (url.query["$filter"]) {
      // substringof
      url.query["$filter"] = url.query["$filter"].replace(/substringof\((.*?),(.*?)\)/gi, "contains($2,$1)");
      // gettotaloffsetminutes
      url.query["$filter"] = url.query["$filter"].replace(/gettotaloffsetminutes\(/gi, "totaloffsetminutes(");
    }
  }

  function convertAnalytics(url, req) {
    const definition = req.context && req.context.definition;
    if (
      !(
        definition &&
        definition.kind === "entity" &&
        url.query["$select"] &&
        (definition["@Analytics"] ||
          definition["@Analytics.query"] ||
          definition["@Aggregation.ApplySupported.PropertyRestrictions"])
      )
    ) {
      return;
    }
    const measures = [];
    const dimensions = [];
    const selects = url.query["$select"].split(",");
    if (url.query["$filter"]) {
      Object.keys(definition.elements || {}).forEach(name => {
        const element = definition.elements[name];
        if (!(element.type === "cds.Composition" || element.type === "cds.Association")) {
          if (new RegExp(`${name}[^a-zA-Z1-9_-]`).test(url.query["$filter"]) && !selects.includes(name)) {
            selects.push(name);
          }
        }
      });
    }
    selects.forEach(select => {
      const element = definition.elements && definition.elements[select];
      if (element) {
        if (element["@Analytics.Measure"]) {
          measures.push(element);
        } else {
          dimensions.push(element);
        }
      }
    });

    if (dimensions.length > 0 || measures.length > 0) {
      url.query["$apply"] = "";
      if (dimensions.length) {
        url.query["$apply"] = "groupby(";
        url.query["$apply"] += `(${dimensions
          .map(dimension => {
            return dimension.name;
          })
          .join(",")})`;
      }
      if (measures.length > 0) {
        if (url.query["$apply"]) {
          url.query["$apply"] += ",";
        }
        url.query["$apply"] += `aggregate(${measures
          .map(measure => {
            let aggregation = measure["@Aggregation.default"] || measure["@DefaultAggregation"];
            aggregation = aggregation ? AggregationMap[(aggregation["#"] || aggregation).toUpperCase()] : "sum";
            return `${measure.name} with ${aggregation} as ${AggregationPrefix}${measure.name}`;
          })
          .join(",")})`;
      }
      if (dimensions.length) {
        url.query["$apply"] += ")";
      }

      if (url.query["$filter"]) {
        url.query["$apply"] = `filter(${url.query["$filter"]})/` + url.query["$apply"];
      }

      if (url.query["$orderby"]) {
        url.query["$orderby"] = url.query["$orderby"]
          .split(",")
          .map(orderBy => {
            let [name, order] = orderBy.split(" ");
            const element = definition.elements && definition.elements[name];
            if (element && element["@Analytics.Measure"]) {
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
        value: measures
      };
    }
  }

  function convertValue(url, req) {
    if (url.contextPath.endsWith("/$value")) {
      url.contextPath = url.contextPath.substr(0, url.contextPath.length - "/$value".length);
      const mediaTypeElementName =
        req.context && req.context.definition && findElementByAnnotation(req.context.definition, "@Core.MediaType");
      if (mediaTypeElementName && !url.contextPath.endsWith(`/${mediaTypeElementName}`)) {
        url.contextPath += `/${mediaTypeElementName}`;
      } else {
        req.context.$value = true;
      }
    }
  }

  function convertRequestBody(body, headers, url, req) {
    let definition = req.context && req.context.definition;
    if (definition) {
      if (definition.kind === "action") {
        body = req.context.bodyParameters || {};
        definition = {
          elements: definition.params || {}
        };
      }
      convertRequestData(body, headers, definition, req);
    }
    delete body.__metadata;
    delete body.__count;
    return JSON.stringify(body);
  }

  function convertRequestData(data, headers, definition, req) {
    if (!Array.isArray(data)) {
      return convertRequestData([data], headers, definition, req);
    }
    // Modify Payload
    data.forEach(data => {
      convertDataTypesToV4(data, headers, definition, data, req);
    });
    // Recursion
    data.forEach(data => {
      Object.keys(data).forEach(key => {
        let element = definition.elements[key];
        if (element && (element.type === "cds.Composition" || element.type === "cds.Association")) {
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
    const contentType = headers["content-type"];
    const ieee754Compatible = contentType && contentType.includes("IEEE754Compatible=true");
    Object.keys(data || {}).forEach(key => {
      if (data[key] === null) {
        return;
      }
      const element = definition.elements && definition.elements[key];
      if (element) {
        if (["cds.Decimal", "cds.DecimalFloat", "cds.Integer64"].includes(element.type)) {
          data[key] = ieee754Compatible ? `${data[key]}` : parseFloat(data[key]);
        } else if (["cds.Double"].includes(element.type)) {
          data[key] = parseFloat(data[key]);
        } else if (["cds.DateTime"].includes(element.type)) {
          const match = data[key].match(/\/Date\((.*)\)\//);
          const milliseconds = match && match.pop();
          if (milliseconds) {
            data[key] = new Date(parseFloat(milliseconds)).toISOString();
          }
        }
      }
    });
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
      const headers = proxyRes.headers;
      normalizeContentType(headers);

      // Pipe Binary Stream
      const contentType = headers["content-type"];
      if (contentType === "application/octet-stream") {
        return await processStream(proxyRes, req, res, headers);
      }

      let body = await parseProxyResponseBody(proxyRes, headers, req);
      // Trace
      traceResponse(req, "Proxy Response", proxyRes.statusCode, proxyRes.statusMessage, headers, body);

      convertBasicHeaders(headers);
      if (body && proxyRes.statusCode < 400) {
        if (isMultipart(req.header("content-type"))) {
          // Multipart
          body = processMultipart(req, body, contentType, null, ({ index, statusCode, contentType, body, headers }) => {
            if (body && statusCode < 400) {
              convertHeaders(body, headers, req);
              if (contentType === "application/json") {
                body = convertResponseBody(Object.assign({}, body), headers, req, index);
              }
            } else {
              body = convertResponseError(body, headers);
            }
            return { body, headers };
          });
        } else {
          // Single
          convertHeaders(body, headers, req);
          if (contentType === "application/json") {
            body = convertResponseBody(Object.assign({}, body), headers, req);
          }
        }
        if (body && headers["transfer-encoding"] !== "chunked" && proxyRes.statusCode !== 204) {
          headers["content-length"] = Buffer.byteLength(body);
        }
      } else {
        body = convertResponseError(body, headers);
      }
      respond(req, res, proxyRes.statusCode, headers, body);
    } catch (err) {
      // Error
      trace(req, "Error", err.toString());
      respond(req, res, proxyRes.statusCode, proxyRes.headers, convertResponseError(proxyRes.body, proxyRes.headers));
    }
  }

  async function processStream(proxyRes, req, res, headers) {
    // Trace
    traceResponse(req, "Proxy Response", proxyRes.statusCode, proxyRes.statusMessage, headers, {});

    convertBasicHeaders(headers);
    const context = req.contexts && req.contexts[0];
    if (context && context.definition && context.definition.elements) {
      const contentDispositionFilenameElement = findElementByAnnotation(
        context.definition,
        "@Core.ContentDisposition.Filename"
      );
      const mediaTypeElement = findElementByAnnotation(context.definition, "@Core.MediaType");
      if (contentDispositionFilenameElement && mediaTypeElement) {
        const parts = getRequestUrl(req).split("/");
        if (parts[parts.length - 1] === "$value") {
          parts.pop();
        }
        if (parts[parts.length - 1] === mediaTypeElement) {
          parts.pop();
        }
        const response = await axios.get(parts.join("/"), {
          headers: req.headers
        });
        const filename =
          response && response.data && response.data.d && response.data.d[contentDispositionFilenameElement];
        if (filename) {
          headers["content-disposition"] = `inline; filename="${filename}"`;
        }
      }
    }
    Object.entries(headers).forEach(([name, value]) => {
      res.setHeader(name, value);
    });
    proxyRes.pipe(res);

    // Trace
    traceResponse(req, "Response", res.statusCode, res.statusMessage, headers, {});
  }

  async function parseProxyResponseBody(proxyRes, headers, req) {
    let bodyParser;
    if (req.method === "HEAD") {
      bodyParser = null;
    } else if (isApplicationJSON(req, headers)) {
      bodyParser = bodyparser.json();
    } else if (isPlainText(req, headers)) {
      bodyParser = bodyparser.text();
    } else if (isMultipart(req.header("content-type"))) {
      bodyParser = bodyparser.text({ type: "multipart/mixed" });
    }
    if (bodyParser) {
      await promisify(bodyParser)(proxyRes, null);
      return proxyRes.body;
    }
  }

  function convertBasicHeaders(headers) {
    delete headers["odata-version"];
    headers.dataserviceversion = "2.0";
  }

  function convertHeaders(body, headers, req) {
    convertBasicHeaders(headers);
    const definition = contextFromBody(body, req);
    if (definition && definition.kind === "entity") {
      convertLocation(body, headers, definition, req);
    }
    convertMessages(body, headers, definition, req);
    return headers;
  }

  function convertLocation(body, headers, entity, req) {
    if (headers.location && entity) {
      headers.location = entityUri(body, entity, req);
    }
  }

  function convertMessages(body, headers, entity, req) {
    if (headers["sap-messages"]) {
      const messages = JSON.parse(headers["sap-messages"]);
      if (messages && messages.length > 0) {
        const message = messages[0];
        message.severity = SeverityMap[message["@Common.numericSeverity"] || message.numericSeverity];
        delete message.numericSeverity;
        delete message["@Common.numericSeverity"];
        headers["sap-message"] = JSON.stringify(message);
      }
      delete headers["sap-messages"];
    }
  }

  function convertResponseError(body, headers) {
    if (!body) {
      return body;
    }
    if (body.error) {
      if (body.error.message) {
        body.error.message = {
          lang: headers["content-language"] || "en",
          value: body.error.message
        };
      }
      if (body.error["@Common.numericSeverity"] || body.error["numericSeverity"]) {
        body.error.severity = SeverityMap[body.error["@Common.numericSeverity"] || body.error["numericSeverity"]];
        delete body.error.numericSeverity;
        delete body.error["@Common.numericSeverity"];
      }
      body.error.innererror = body.error.innererror || {};
      body.error.innererror.errordetails = body.error.innererror.errordetails || [];
      if (body.error.details) {
        body.error.innererror.errordetails.push(...body.error.details);
        body.error.innererror.errordetails.forEach(detail => {
          detail.severity =
            detail.severity || SeverityMap[detail["@Common.numericSeverity"] || detail["numericSeverity"]] || "error";
          delete detail.numericSeverity;
          delete detail["@Common.numericSeverity"];
        });
      }
      delete body.error.details;
    }
    if (typeof body === "object") {
      body = JSON.stringify(body);
    }
    body = `${body}`;
    headers["content-length"] = Buffer.byteLength(body);
    return body;
  }

  function convertResponseBody(proxyBody, headers, req, index = 0) {
    const body = {
      d: {}
    };
    req.context = req.contexts[index] || {};

    if (req.context.serviceRoot && proxyBody.value) {
      // Service Root
      body.d.EntitySets = proxyBody.value.map(entry => {
        return entry.name;
      });
    } else {
      // Context from Body
      const definition = contextFromBody(proxyBody, req);
      if (definition) {
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
          const data = convertResponseList(body, proxyBody, req);
          convertResponseData(data, headers, definition, proxyBody, req);
        }
      } else {
        // Context from Request
        let definition = req.context.definition;
        const data = convertResponseList(body, proxyBody, req);
        if (definition && (definition.kind === "function" || definition.kind === "action")) {
          const returns =
            (definition.returns && definition.returns.items && definition.returns.items) || definition.returns;
          definition = lookupDefinition(returns.type, req) || {
            elements: {
              value: returns
            }
          };
          req.context.definition = definition;
          convertResponseData(data, headers, definition, proxyBody, req);
        } else {
          convertResponseData(data, headers, definition, proxyBody, req);
        }
      }
    }

    return JSON.stringify(body);
  }

  function convertResponseList(body, proxyBody, req) {
    if (Array.isArray(proxyBody.value)) {
      if (req.context.aggregationKey) {
        proxyBody = proxyBody.value[0] || {};
      } else {
        body.d.results = proxyBody.value || [];
        if (proxyBody["@odata.count"] !== undefined) {
          body.d.__count = proxyBody["@odata.count"];
        }
        body.d.results = body.d.results.map(entry => {
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
    // Modify Payload
    data.forEach(data => {
      removeMetadata(data, headers, definition, proxyBody, req);
      addMetadata(data, headers, definition, proxyBody, req);
      convertAggregation(data, headers, definition, proxyBody, req);
      convertDataTypesToV2(data, headers, definition, proxyBody, req);
    });
    // Recursion
    data.forEach(data => {
      Object.keys(data).forEach(key => {
        let element = definition.elements && definition.elements[key];
        if (!element) {
          return;
        }
        if (element.type === "cds.Composition" || element.type === "cds.Association") {
          convertResponseData(data[key], headers, element._target, proxyBody, req);
        }
      });
    });
    // Structural Changes
    data.forEach(data => {
      addResultsNesting(data, headers, definition, proxyBody, req);
    });
    // Deferreds
    data.forEach(data => {
      addDeferreds(data, headers, definition, proxyBody, req);
    });
  }

  function convertResponseElementData(data, headers, definition, proxyBody, req) {
    if (!definition) {
      return;
    }
    // Modify Payload
    convertDataTypesToV2(data, headers, definition, proxyBody, req);
  }

  function contextFromBody(body, req) {
    let context = body["@odata.context"];
    if (!context) {
      return null;
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
    if (context) {
      return lookupDefinition(context, req);
    }
  }

  function contextElementFromBody(body, req) {
    let context = body["@odata.context"];
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

  function removeMetadata(data, headers, definition, root, req) {
    Object.keys(data).forEach(key => {
      if (key.startsWith("@")) {
        delete data[key];
      }
    });
  }

  function addMetadata(data, headers, definition, root, req) {
    if (definition.kind !== "entity") {
      return;
    }
    data.__metadata = {
      uri: entityUri(data, definition, req),
      type: definition.name
    };
    if (root["@odata.metadataEtag"]) {
      data.__metadata.etag = root["@odata.metadataEtag"];
    }
  }

  function convertAggregation(data, headers, definition, body, req) {
    if (!req.context.$apply) {
      return;
    }
    Object.keys(data).forEach(key => {
      if (key.startsWith(AggregationPrefix)) {
        if (key.endsWith("@odata.type")) {
          delete data[key];
        } else {
          data[key.substr(AggregationPrefix.length)] = String(data[key]);
          delete data[key];
        }
      }
    });
    const aggregationKey = {
      key: req.context.$apply.key.reduce((result, keyElement) => {
        let value = data[keyElement.name];
        if (value !== undefined && value !== null && DataTypeMap[keyElement.type]) {
          value = value.replace(/(.*)/, DataTypeMap[keyElement.type].v2);
        }
        result[keyElement.name] = value;
        return result;
      }, {}),
      value: req.context.$apply.value.map(valueElement => {
        return valueElement.name;
      })
    };
    data.__metadata.uri = entityUriKey(`aggregation'${JSON.stringify(aggregationKey)}'`, definition, req);
    delete data.__metadata.etag;
  }

  function convertDataTypesToV2(data, headers, definition, body, req) {
    Object.keys(data).forEach(key => {
      if (data[key] === null) {
        return;
      }
      const element = definition.elements && definition.elements[key];
      if (!element) {
        return;
      }
      if (["cds.Decimal", "cds.DecimalFloat", "cds.Double", "cds.Integer64"].includes(element.type)) {
        data[key] = `${data[key]}`;
      } else if (["cds.Date", "cds.DateTime", "cds.Timestamp"].includes(element.type)) {
        data[key] = `/Date(${new Date(data[key]).getTime()})/`;
      }
    });
  }

  function addResultsNesting(data, headers, definition, root, req) {
    Object.keys(data).forEach(key => {
      if (!(definition.elements && definition.elements[key])) {
        return;
      }
      if (definition.elements[key].cardinality && definition.elements[key].cardinality.max === "*") {
        data[key] = {
          results: data[key]
        };
      }
    });
  }

  function addDeferreds(data, headers, definition, root, req) {
    if (definition.kind !== "entity" || req.context.$apply) {
      return;
    }
    Object.keys(definition.elements || {}).forEach(key => {
      let element = definition.elements[key];
      if (element && (element.type === "cds.Composition" || element.type === "cds.Association")) {
        if (data[key] === undefined) {
          data[key] = {
            __deferred: {
              uri: `${entityUri(data, definition, req)}/${key}`
            }
          };
        }
      }
    });
  }

  function entityUri(data, entity, req) {
    return entityUriKey(entityKey(data, entity), entity, req);
  }

  function entityUriKey(key, entity, req) {
    let protocol = req.header("x-forwarded-proto") || req.protocol || "http";
    let host = req.header("x-forwarded-host") || req.hostname || "localhost";
    let port = req.header("x-forwarded-host") ? "" : `:${req.socket.address().port}`;
    return `${protocol}://${host}${port}${sourcePath}/${req.servicePath}/${entity.name.split(".").pop()}(${encodeURIKey(key)})`;
  }

  function entityKey(data, entity) {
    let keyElements = Object.keys(entity.elements)
      .filter(key => {
        return entity.elements[key].key;
      })
      .map(key => {
        return entity.elements[key];
      });
    return keyElements
      .map(keyElement => {
        let value = data[keyElement.name];
        if (value !== undefined && value !== null && DataTypeMap[keyElement.type]) {
          value = value.replace(/(.*)/, DataTypeMap[keyElement.type].v2);
        }
        if (keyElements.length === 1) {
          return `${value}`;
        } else {
          return `${keyElement.name}=${value}`;
        }
      })
      .join(",");
  }

  function respond(req, res, statusCode, headers, body) {
    if (!res.headersSent) {
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
      if (contentType.startsWith("application/json")) {
        contentType = contentType.replace(/(application\/json).*/gi, "$1").trim();
      }
      headers["content-type"] = contentType;
    }
    return contentType;
  }

  function isMultipart(contentType) {
    return contentType && contentType.replace(/\s/g, "").startsWith("multipart/mixed;boundary=");
  }

  function isApplicationJSON(req, headers) {
    return headers["content-type"] === "application/json";
  }

  function isPlainText(req, headers) {
    return headers["content-type"] === "text/plain";
  }

  function encodeURIKey(key) {
    return key.replace(/[ ]/g, "%20").replace(/[/]/g, "%2F");
  }

  function decodeURIKey(key) {
    return key.replace(/%20/g, " ").replace(/%2F/g, "/");
  }

  function getRequestUrl(req) {
    return getBaseUrl(req) + req.originalUrl;
  }

  function getBaseUrl(req) {
    return req.protocol + "://" + req.get("host");
  }

  function findElementByAnnotation(definition, annotation) {
    return (
      definition &&
      definition.elements &&
      Object.keys(definition.elements).find(key => {
        const element = definition.elements[key];
        return element && !!element[annotation];
      })
    );
  }

  function processMultipart(req, multiPartBody, contentType, urlProcessor, bodyHeadersProcessor) {
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
    let body = "";
    let headers = {};
    let method = "";
    let url = "";
    let parts = multiPartBody.split("\r\n");
    const newParts = [];
    parts.forEach(part => {
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
              if (contentType === "application/json") {
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
                contentId
              });
              body = (result && result.body) || body;
              headers = (result && result.headers) || headers;
            } catch (err) {
              // Error
              trace(req, "Error", err.toString());
            }
          }
          Object.entries(headers).forEach(([name, value]) => {
            newParts.splice(-1, 0, `${name}: ${value}`);
          });
          newParts.push(body);
          statusCode = undefined;
          contentId = undefined;
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
          const result = urlProcessor({ method: partMethod, url: partUrl, contentId });
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
            statusCode = statusCodeMatch.pop();
          }
        }
      } else if (bodyAfterBlank && (previousLineIsBlank || body !== "")) {
        body = body ? `${body}\r\n${part}` : part;
      } else if (part !== "") {
        if (!bodyAfterBlank) {
          if (part.toLowerCase().startsWith("content-id:")) {
            let colonIndex = part.indexOf(":");
            if (colonIndex !== -1) {
              contentId = part.substr(colonIndex + 1).trim();
            }
          }
          newParts.push(part);
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

  function traceRequest(req, name, method, url, body) {
    const _url = decodeURI(url) || "";
    const _body = typeof body === "string" ? decodeURI(body) : body ? decodeURI(JSON.stringify(body)) : "";
    trace(req, name, `${method} ${_url}`, _body);
  }

  function traceResponse(req, name, statusCode, statusMessage, headers, body) {
    const _headers = decodeURI(JSON.stringify(headers));
    const _body = typeof body === "string" ? decodeURI(body) : body ? decodeURI(JSON.stringify(body)) : "";
    trace(req, name, `${statusCode || ""} ${statusMessage || ""}`, _headers, _body);
  }

  function trace(req, name, ...messages) {
    const message = messages.filter(message => message !== null && message !== undefined).join("\n");
    req.loggingContext.getTracer(name).info(message);
  }

  return router;
};
