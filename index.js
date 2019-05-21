'use strict';

// OData v2/v4 Delta: http://docs.oasis-open.org/odata/new-in-odata/v4.0/cn01/new-in-odata-v4.0-cn01.html

const URL = require('url');
const express = require('express');
const bodyparser = require('body-parser');
const proxy = require('http-proxy-middleware');
const cds = require('@sap/cds');
const logging = require('@sap/logging');

const proxyCache = {};

const SeverityMap = {
    1: 'success',
    2: 'info',
    3: 'warning',
    4: 'error'
};

const DataTypeMap = {
    'cds.UUID': {v2: `guid'$1'`, v4: /guid'(.{36})'/gi},
    'cds.Binary': {v2: `binary'$1'`, v4: /X'(.+)'/gi},
    'cds.LargeBinary': {v2: `binary'$1'`, v4: /X'(.+)'/gi},
    'cds.Time': {v2: `time'$1'`, v4: /time'(.+)'/gi},
    'cds.Date': {v2: `datetime'$1'`, v4: /datetime'(.+)'/gi},
    'cds.DateTime': {v2: `datetimeoffset'$1'`, v4: /datetimeoffset'(.+)'g/i},
    'cds.Timestamp': {v2: `datetimeoffset'$1'`, v4: /datetimeoffset'(.+)'/gi},
    'cds.Double': {v2: `$1d`, v4: /([0-9]+((\.[0-9]+)|[E[+|-][0-9]+]))d/gi},
    'cds.Decimal': {v2: `$1m`, v4: /([0-9]+\.[0-9]+)m/gi},
    'cds.DecimalFloat': {v2: `$1f`, v4: /([0-9]+\.[0-9]+)f/gi},
    'cds.Integer64': {v2: `$1L`, v4: /([-]?[0-9]+)L/gi},
    'cds.String': {v2: `'$1'`, v4: /(.*)/gi}
};

/**
 * Instantiates an CDS OData v2 Adapter Proxy Express Router for a CDS based OData v4 Server
 * @param options CDS OData v2 Adapter Proxy options
 * @param [options.path] Path, under which the proxy is reachable. Default is 'v2'
 * @param [options.model] CDS service model path. Default is 'all'.
 * @param [options.port] Target port, which points to OData v4 backend port. Default is '4004'
 * @param [options.target] Target, which points to OData v4 backend host/port. Default is 'http://localhost:4004'
 * @param [options.services] Service mapping, from url path name to service name. If omitted CDS defaults apply.
 * @returns {Router}
 */
module.exports = options => {
    const appContext = logging.createAppContext();
    const router = express.Router();
    const path = (options && options.path) || 'v2';
    const pathRewrite = `^/${path}/`;
    const port = (options && options.port) || '4004';
    const target = (options && options.target) || `http://localhost:${port}`;
    const services = (options && options.services) || {};

    let model = (options && options.model) || 'all';
    if (model === 'all' || (Array.isArray(model) && model[0] === 'all')) {
        model = [cds.env.folders.app, cds.env.folders.srv, 'services', '.'].find(m => cds.resolve(m));
    }

    router.use(`/${path}/:service/`, logging.middleware({appContext: appContext, logNetwork: true}));

    router.get(`/${path}/:service/\\$metadata`, async (req, res) => {
        try {
            const servicePath = req.params.service;
            const service = normalizeService(servicePath, services);
            const {edmx} = await loadService(service, model);
            res.setHeader('content-type', 'application/xml');
            res.send(edmx);
        } catch (err) {
            res.status(404).end();
        }
    });

    router.use(
        `/${path}/:service/`,

        // Body Parsers
        bodyparser.text({type: 'multipart/mixed'}),
        bodyparser.json(),

        // Inject Context
        (req, res, next) => {
            const servicePath = req.params.service;
            const service = normalizeService(servicePath, services);
            loadService(service, model)
                .then(({csn}) => {
                    req.csn = csn;
                    req.service = service;
                    req.servicePath = servicePath;
                    req.context = {};
                    req.contexts = [];
                    req.contentId = {};
                    next();
                })
                .catch(err => {
                    res.status(404).end();
                });
        },

        // Proxy Middleware
        proxy({
            target,
            changeOrigin: true,
            selfHandleResponse: true,
            pathRewrite: {
                [pathRewrite]: '/'
            },
            onProxyReq: (proxyReq, req, res, next) => {
                convertProxyRequest(proxyReq, req, res);
            },
            onProxyRes: (proxyRes, req, res) => {
                convertProxyResponse(proxyRes, req, res);
            }
        })
    );

    return router;
};

async function loadService(service, model) {
    if (!proxyCache[service]) {
        const csn = await cds.load(model);
        const reflectedCsn = cds.linked(cds.compile.for.odata(csn));
        const edmx = await cds.compile.to.edmx(csn, {service: service});
        proxyCache[service] = {csn: reflectedCsn, edmx};
    }
    return proxyCache[service];
}

function normalizeService(name, services) {
    let service = (services || {})[name];
    if (!service) {
        service = name.charAt(0).toUpperCase() + name.slice(1) + 'Service';
    }
    return service;
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
function convertProxyRequest(proxyReq, req, res) {
    // Trace
    traceRequest(req, 'Request', req.method, proxyReq.path, req.body);

    let body = req.body;
    const contentType = req.header('content-type');

    if (isMultipart(req)) {
        // Multipart
        body = processMultipart(
            req,
            req.body,
            contentType,
            ({method, url, contentId}) => {
                return {
                    method: method === 'MERGE' ? 'PATCH' : method,
                    url: convertUrl(url, contentId, req)
                };
            },
            ({contentType, body, headers, url}) => {
                delete headers.DataServiceVersion;
                delete headers.MaxDataServiceVersion;
                if (contentType === 'application/json') {
                    body = convertRequestBody(body, headers, url, req);
                }
                return {body, headers};
            }
        );
    } else {
        // Single
        proxyReq.path = convertUrl(proxyReq.path, undefined, req);
        if (contentType === 'application/json') {
            body = convertRequestBody(req.body, req.headers, proxyReq.path, req);
        }
    }

    if (req.body) {
        delete req.body;
    }
    if (contentType) {
        proxyReq.setHeader('content-length', Buffer.byteLength(body));
        proxyReq.write(body);
    }
    proxyReq.method = proxyReq.method === 'MERGE' ? 'PATCH' : proxyReq.method;
    proxyReq.end();

    // Trace
    traceRequest(req, 'Proxy Request', proxyReq.method, proxyReq.path, body);
}

function convertUrl(urlPath, contentId, req) {
    let url = parseURL(urlPath, req);
    const definition = contextFromUrl(url, req);
    enrichRequest(definition, url, contentId, req);

    convertUrlDataTypes(url, req);
    convertUrlCount(url, req);
    convertActionFunction(url, req);
    convertExpandSelect(url, req);
    convertFilter(url, req);
    convertValue(url, req);

    delete url.search;
    url.pathname = url.servicePath + url.contextPath;
    url.pathname = encodeURI(url.pathname);
    return URL.format(url);
}

function parseURL(urlPath, req) {
    const url = URL.parse(decodeURI(urlPath), true);
    url.pathname = decodeURI(url.pathname);
    url.contextPath = url.pathname;
    url.servicePath = '';
    if (url.contextPath.startsWith(`/${req.servicePath}/`)) {
        url.servicePath = `/${req.servicePath}/`;
        url.contextPath = url.contextPath.substr(url.servicePath.length);
    }
    if (url.contextPath === `/${req.servicePath}`) {
        url.servicePath = `/${req.servicePath}`;
        url.contextPath = url.contextPath.substr(url.servicePath.length);
    }
    if (url.contextPath.startsWith('/')) {
        url.servicePath = '/';
        url.contextPath = url.contextPath.substr(1);
    }
    return url;
}

function contextFromUrl(url, req) {
    let stop = false;
    return url.contextPath.split('/').reduce((context, part) => {
        if (stop) {
            return context;
        }
        const keyStart = part.indexOf('(');
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
    if (!context) {
        if (name.startsWith('$') && req.contentId[name]) {
            return contextFromUrl(req.contentId[name], req);
        } else {
            context = lookupDefinition(name, req);
            if (!context) {
                context = lookupBoundDefinition(name, req);
            }
            return context;
        }
    } else {
        if (name.startsWith('$')) {
            return context;
        }
        const element = context.elements && context.elements[name];
        if (element) {
            if (element.type === 'cds.Composition' || element.type === 'cds.Association') {
                // Navigation
                return element._target;
            } else {
                // Attribute
                return context;
            }
        }
    }
}

function enrichRequest(definition, url, contentId, req) {
    req.context = {
        url: url,
        definition: definition,
        serviceRoot: url.contextPath.length === 0,
        parameters: {}
    };
    req.contexts.push(req.context);
    if (contentId) {
        req.contentId[`$${contentId}`] = url;
    }
}

function convertUrlDataTypes(url, req) {
    // Keys
    let context;
    let stop = false;
    url.contextPath = url.contextPath
        .split('/')
        .map(part => {
            if (stop) {
                return part;
            }
            let keyPart = '';
            const keyStart = part.indexOf('(');
            const keyEnd = part.lastIndexOf(')');
            if (keyStart !== -1 && keyEnd === part.length - 1) {
                keyPart = part.substring(keyStart + 1, keyEnd);
                part = part.substr(0, keyStart);
            }
            context = lookupContext(part, context, req);
            if (!context) {
                stop = true;
            }
            if (context && context.elements && keyPart) {
                const keys = keyPart.split(',');
                return `${part}(${keys.map(key => {
                    const [name, value] = key.split('=');
                    if (name && value) {
                        const type = context.elements[name] && context.elements[name].type;
                        return `${name}=${DataTypeMap[type] ? value.replace(DataTypeMap[type].v4, '$1') : value}`;
                    } else if (context.keys) {
                        const keyName = Object.keys(context.keys)[0];
                        const type = context.elements[keyName] && context.elements[keyName].type;
                        return `${DataTypeMap[type] ? name.replace(DataTypeMap[type].v4, '$1') : name}`;
                    }
                })})`;
            } else {
                return part;
            }
        })
        .join('/');

    // Query
    Object.keys(url.query).forEach(name => {
        if (name === '$filter') {
            Object.keys(DataTypeMap).forEach(type => {
                url.query[name] = url.query[name].replace(DataTypeMap[type].v4, '$1');
            });
        } else if (!name.startsWith('$')) {
            if (context && context.elements && context.elements[name]) {
                const element = context.elements[name];
                if (DataTypeMap[element.type]) {
                    url.query[name] = url.query[name].replace(DataTypeMap[element.type].v4, '$1');
                }
            }
            if (context && (context.kind === 'function' || context.kind === 'action')) {
                if (context.params && context.params[name]) {
                    const element = context.params[name];
                    if (DataTypeMap[element.type]) {
                        url.query[name] = url.query[name].replace(DataTypeMap[element.type].v4, '$1');
                    }
                }
                if (context.parent && context.parent.kind === 'entity') {
                    if (context.parent && context.parent.elements && context.parent.elements[name]) {
                        const element = context.parent.elements[name];
                        if (DataTypeMap[element.type]) {
                            url.query[name] = url.query[name].replace(DataTypeMap[element.type].v4, '$1');
                        }
                    }
                }
            }
        }
    });
}

function convertUrlCount(url, req) {
    if (url.query['$inlinecount']) {
        url.query['$count'] = url.query['$inlinecount'] === 'allpages';
        delete url.query['$inlinecount'];
    }
    return url;
}

function convertActionFunction(url, req) {
    const definition = req.context && req.context.definition;
    if (!(definition && (definition.kind === 'function' || definition.kind === 'action'))) {
        return;
    }
    // Key Parameters
    if (definition.parent && definition.parent.kind === 'entity') {
        url.contextPath = definition.parent.name.split('.').pop();
        url.contextPath += `(${Object.keys(definition.parent.keys)
            .reduce((result, name) => {
                const element = definition.parent.elements && definition.parent.elements[name];
                const value = url.query[name] || '';
                result.push(`${name}=${quoteParameter(element, value, req)}`);
                delete url.query[name];
                return result;
            }, [])
            .join(',')})`;
        url.contextPath += `/${req.service}.${definition.name}`;
    }
    // Function Parameters
    if (definition.kind === 'function') {
        url.contextPath += `(${Object.keys(url.query)
            .reduce((result, name) => {
                if (!name.startsWith('$')) {
                    const element = definition.params && definition.params[name];
                    if (element) {
                        const value = url.query[name];
                        result.push(`${name}=${quoteParameter(element, value, req)}`);
                        delete url.query[name];
                    }
                }
                return result;
            }, [])
            .join(',')})`;
    }
    if (definition.kind === 'action') {
        Object.keys(url.query).forEach(name => {
            if (!name.startsWith('$')) {
                const element = definition.params && definition.params[name];
                let value = url.query[name];
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
    if (!element || ['cds.Date', 'cds.Time', 'cds.DateTime', 'cds.Timestamp', 'cds.String', 'cds.LargeString'].includes(element.type)) {
        return `'${value.replace(/^["'](.*)["']$/, '$1')}'`;
    }
    return value;
}

function unquoteParameter(element, value, req) {
    if (!element || ['cds.Date', 'cds.Time', 'cds.DateTime', 'cds.Timestamp', 'cds.String', 'cds.LargeString'].includes(element.type)) {
        return value.replace(/^["'](.*)["']$/, '$1');
    }
    return value;
}

function parseParameter(element, value, req) {
    if (!element) {
        return value;
    }
    if (['cds.Boolean'].includes(element.type)) {
        return value === 'true';
    } else if (['cds.Integer'].includes(element.type)) {
        return parseInt(value);
    }
    return value;
}

function convertExpandSelect(url, req) {
    const definition = req.context && req.context.definition;
    if (definition) {
        const context = {select: {}, expand: {}};
        if (url.query['$expand']) {
            const expands = url.query['$expand'].split(',');
            expands.forEach(expand => {
                let current = context.expand;
                expand.split('/').forEach(part => {
                    current[part] = current[part] || {select: {}, expand: {}};
                    current = current[part].expand;
                });
            });
        }
        if (url.query['$select']) {
            const selects = url.query['$select'].split(',');
            selects.forEach(select => {
                let current = context;
                let currentDefinition = definition;
                select.split('/').forEach(part => {
                    if (!current) {
                        return;
                    }
                    const element = currentDefinition.elements && currentDefinition.elements[part];
                    if (element) {
                        if (element.type === 'cds.Composition' || element.type === 'cds.Association') {
                            current = current && current.expand[part];
                            currentDefinition = element._target;
                        } else if (current && current.select) {
                            current.select[part] = true;
                        }
                    }
                });
            });
            url.query['$select'] = Object.keys(context.select).join(',');
        }
        if (url.query['$expand']) {
            const serializeExpand = expand => {
                return Object.keys(expand || {})
                    .map(name => {
                        let value = expand[name];
                        let result = name;
                        const selects = Object.keys(value.select);
                        const expands = Object.keys(value.expand);
                        if (selects.length > 0 || expands.length > 0) {
                            result += '(';
                            if (selects.length > 0) {
                                result += `$select=${selects.join(',')}`;
                            }
                            if (expands.length > 0) {
                                if (selects.length > 0) {
                                    result += ';';
                                }
                                result += `$expand=${serializeExpand(value.expand)}`;
                            }
                            result += ')';
                        }
                        return result;
                    })
                    .join(',');
            };
            url.query['$expand'] = serializeExpand(context.expand);
        }
    }
}

function convertFilter(url, req) {
    if (url.query['$filter']) {
        // substringof
        url.query['$filter'] = url.query['$filter'].replace(/substringof\((.*?),(.*?)\)/gi, 'contains($2,$1)');
        // gettotaloffsetminutes
        url.query['$filter'] = url.query['$filter'].replace(/gettotaloffsetminutes\(/gi, 'totaloffsetminutes(');
    }
}

function convertValue(url, req) {
    if (url.contextPath.endsWith('/$value')) {
        url.contextPath = url.contextPath.substr(0, url.contextPath.length - '/$value'.length);
        req.context.$value = true;
    }
}

function convertRequestBody(body, headers, url, req) {
    let definition = req.context && req.context.definition;
    if (definition) {
        if (definition.kind === 'action') {
            body = req.context.bodyParameters || {};
            definition = {
                elements: definition.params || {}
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
    // Modify Payload
    data.forEach(data => {
        convertDataTypesToV4(data, headers, definition, data, req);
    });
    // Recursion
    data.forEach(data => {
        Object.keys(data).forEach(key => {
            let element = definition.elements[key];
            if (!element) {
                return;
            }
            if (element.type === 'cds.Composition' || element.type === 'cds.Association') {
                convertRequestData(data[key], headers, element._target, req);
            }
        });
    });
}

function convertDataTypesToV4(data, headers, definition, body, req) {
    const contentType = headers['content-type'];
    const ieee754Compatible = contentType && contentType.includes('IEEE754Compatible=true');
    Object.keys(data || {}).forEach(key => {
        if (data[key] === null) {
            return;
        }
        const element = definition.elements && definition.elements[key];
        if (!element) {
            return;
        }
        if (['cds.Decimal', 'cds.DecimalFloat', 'cds.Integer64'].includes(element.type)) {
            data[key] = ieee754Compatible ? `${data[key]}` : parseFloat(data[key]);
        } else if (['cds.Double'].includes(element.type)) {
            data[key] = parseFloat(data[key]);
        }
    });
}

/**
 * Convert Proxy Response (v4 -> v2)
 * @param proxyRes Proxy Request
 * @param req Request
 * @param res Response
 */
function convertProxyResponse(proxyRes, req, res) {
    req.context = {};
    const headers = proxyRes.headers;
    normalizeContentType(headers);

    parseProxyResponseBody(proxyRes, headers, req)
        .then(body => {
            // Trace
            traceResponse(req, 'Proxy Response', headers, body);

            convertBasicHeaders(headers);
            if (body && proxyRes.statusCode < 400) {
                const contentType = headers['content-type'];

                if (isMultipart(req)) {
                    // Multipart
                    body = processMultipart(req, body, contentType, null, ({index, statusCode, contentType, body, headers}) => {
                        if (body && statusCode < 400) {
                            convertHeaders(body, headers, req);
                            if (contentType === 'application/json') {
                                body = convertResponseBody(Object.assign({}, body), headers, req, index);
                            }
                        } else {
                            body = convertResponseError(body, headers);
                        }
                        return {body, headers};
                    });
                } else {
                    // Single
                    convertHeaders(body, headers, req);
                    if (contentType === 'application/json') {
                        body = convertResponseBody(Object.assign({}, body), headers, req);
                    }
                }
                if (body && headers['transfer-encoding'] !== 'chunked' && proxyRes.statusCode !== 204) {
                    headers['content-length'] = Buffer.byteLength(body);
                }
            } else {
                body = convertResponseError(body, headers);
            }
            respond(req, res, proxyRes.statusCode, headers, body);
        })
        .catch(err => {
            // Error
            console.log(err);
            req.loggingContext.getTracer('Error').error(err.toString());
            respond(req, res, proxyRes.statusCode, proxyRes.headers, convertResponseError(proxyRes.body, proxyRes.headers));
        });
}

async function parseProxyResponseBody(proxyRes, headers, req) {
    return new Promise((resolve, reject) => {
        let bodyParser;
        if (isMultipart(req)) {
            bodyParser = bodyparser.text({type: 'multipart/mixed'});
        } else if (isApplicationJSON(req, headers)) {
            bodyParser = bodyparser.json();
        } else if (isPlainText(req, headers)) {
            bodyParser = bodyparser.text();
        }
        if (bodyParser) {
            bodyParser(proxyRes, null, err => {
                if (err) {
                    reject(err);
                } else {
                    resolve(proxyRes.body);
                }
            });
        } else {
            resolve(undefined);
        }
    });
}

function convertBasicHeaders(headers) {
    delete headers['odata-version'];
    headers.dataserviceversion = '2.0';
}

function convertHeaders(body, headers, req) {
    convertBasicHeaders(headers);
    const definition = contextFromBody(body, req);
    if (definition && definition.kind === 'entity') {
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
    if (headers['sap-messages']) {
        const messages = JSON.parse(headers['sap-messages']);
        if (messages && messages.length > 0) {
            const message = messages[0];
            message.severity = SeverityMap[message['@Common.numericSeverity'] || message.numericSeverity];
            delete message.numericSeverity;
            delete message['@Common.numericSeverity'];
            headers['sap-message'] = JSON.stringify(message);
        }
        delete headers['sap-messages'];
    }
}

function convertResponseError(body, headers) {
    if (!body) {
        return body;
    }
    if (body.error) {
        if (body.error.message) {
            body.error.message = {
                lang: headers['content-language'] || 'en',
                value: body.error.message
            };
        }
        if (body.error['@Common.numericSeverity'] || body.error['numericSeverity']) {
            body.error.severity = SeverityMap[body.error['@Common.numericSeverity'] || body.error['numericSeverity']];
            delete body.error.numericSeverity;
            delete body.error['@Common.numericSeverity'];
        }
        if (body.error.details) {
            body.error.innererror = body.error.innererror || {};
            body.error.innererror.errordetails = body.error.innererror.errordetails || [];
            body.error.innererror.errordetails.push(...body.error.details);
            body.error.innererror.errordetails.forEach(detail => {
                detail.severity = detail.severity || SeverityMap[detail['@Common.numericSeverity'] || detail['numericSeverity']] || 'error';
                delete detail.numericSeverity;
                delete detail['@Common.numericSeverity'];
            });
        }
        delete body.error.details;
    }
    if (typeof body === 'object') {
        body = JSON.stringify(body);
    }
    body = `${body}`;
    headers['content-length'] = Buffer.byteLength(body);
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
                if (req.context.$value) {
                    headers['content-type'] = 'text/plain';
                    return `${proxyBody.value}`;
                } else {
                    body.d[definitionElement.name] = proxyBody.value;
                }
                convertResponseElementData(body, headers, definition, proxyBody, req);
            } else {
                const data = convertResponseList(body, proxyBody);
                convertResponseData(data, headers, definition, proxyBody, req);
            }
        } else {
            // Context from Request
            let definition = req.context.definition;
            const data = convertResponseList(body, proxyBody);
            if (definition && (definition.kind === 'function' || definition.kind === 'action')) {
                const returnValue = (definition.returns && definition.returns.items && definition.returns.items) || definition.returns;
                definition = lookupDefinition(returnValue.type, req) || {
                    elements: {
                        value: returnValue
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

function convertResponseList(body, proxyBody) {
    if (Array.isArray(proxyBody.value)) {
        body.d.results = proxyBody.value || [];
        if (proxyBody['@odata.count'] !== undefined) {
            body.d.__count = proxyBody['@odata.count'];
        }
        body.d.results = body.d.results.map(entry => {
            return typeof entry == 'object' ? entry : {value: entry};
        });
    } else {
        body.d = proxyBody;
    }
    return body.d.results || [body.d];
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
        convertDataTypesToV2(data, headers, definition, proxyBody, req);
    });
    // Recursion
    data.forEach(data => {
        Object.keys(data).forEach(key => {
            let element = definition.elements && definition.elements[key];
            if (!element) {
                return;
            }
            if (element.type === 'cds.Composition' || element.type === 'cds.Association') {
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
    let context = body['@odata.context'];
    if (!context) {
        return null;
    }
    context = context.substr(context.indexOf('#') + 1);
    if (context.startsWith('Collection(')) {
        context = context.substring('Collection('.length, context.indexOf(')'));
    } else {
        if (context.indexOf('(') !== -1) {
            context = context.substr(0, context.indexOf('('));
        }
    }
    if (context.indexOf('/') !== -1) {
        context = context.substr(0, context.indexOf('/'));
    }
    if (context) {
        return lookupDefinition(context, req);
    }
}

function contextElementFromBody(body, req) {
    let context = body['@odata.context'];
    if (!context) {
        return null;
    }
    const definition = contextFromBody(body, req);
    if (!definition) {
        return;
    }
    if (context.lastIndexOf('/') === -1) {
        return;
    }
    const name = context.substr(context.lastIndexOf('/') + 1);
    if (name && !name.startsWith('$')) {
        const element = definition.elements && definition.elements[name];
        if (element) {
            return element;
        }
    }
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
        if (['cds.Decimal', 'cds.DecimalFloat', 'cds.Double', 'cds.Integer64'].includes(element.type)) {
            data[key] = `${data[key]}`;
        } else if (['cds.Date', 'cds.DateTime', 'cds.Timestamp'].includes(element.type)) {
            data[key] = `/Date(${new Date(data[key]).getTime()})/`;
        }
    });
}

function removeMetadata(data, headers, definition, root, req) {
    Object.keys(data).forEach(key => {
        if (key.startsWith('@')) {
            delete data[key];
        }
    });
}

function addMetadata(data, headers, definition, root, req) {
    if (definition.kind !== 'entity') {
        return;
    }
    data.__metadata = {
        uri: entityUri(data, definition, req),
        type: definition.name
    };
    if (root['@odata.metadataEtag']) {
        data.__metadata.etag = root['@odata.metadataEtag'];
    }
}

function addDeferreds(data, headers, definition, root, req) {
    if (definition.kind !== 'entity') {
        return;
    }
    Object.keys(definition.elements || {}).forEach(key => {
        let element = definition.elements[key];
        if (element && (element.type === 'cds.Composition' || element.type === 'cds.Association')) {
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

function addResultsNesting(data, headers, definition, root, req) {
    Object.keys(data).forEach(key => {
        if (!(definition.elements && definition.elements[key])) {
            return;
        }
        if (definition.elements[key].cardinality && definition.elements[key].cardinality.max === '*') {
            data[key] = {
                results: data[key]
            };
        }
    });
}

function entityUri(data, entity, req) {
    let protocol = req.header('x-forwarded-proto') || req.protocol || 'http';
    let host = req.header('x-forwarded-host') || req.hostname || 'localhost';
    let port = req.header('x-forwarded-host') ? '' : `:${req.socket.address().port}`;
    return `${protocol}://${host}${port}${req.baseUrl}/${entity.name.split('.').pop()}(${entityKey(data, entity)})`;
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
            if (DataTypeMap[keyElement.type]) {
                value = value.replace(/(.*)/, DataTypeMap[keyElement.type].v2);
            }
            if (keyElements.length === 1) {
                return value;
            } else {
                return `${keyElement.name}=${value}`;
            }
        })
        .join(',');
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
        traceResponse(req, 'Response', headers, body);
    }
}

function normalizeContentType(headers) {
    let contentType = headers['content-type'];
    if (contentType) {
        contentType = contentType.trim();
        if (contentType.startsWith('application/json')) {
            contentType = contentType.replace(/(application\/json).*/gi, '$1').trim();
        }
        headers['content-type'] = contentType;
    }
    return contentType;
}

function isMultipart(req, headers) {
    const contentType = req.header('content-type');
    return contentType && (contentType.startsWith('multipart/mixed;boundary=') || contentType.startsWith('multipart/ mixed;boundary='));
}

function isApplicationJSON(req, headers) {
    return headers['content-type'] === 'application/json';
}

function isPlainText(req, headers) {
    return headers['content-type'] === 'text/plain';
}

function processMultipart(req, multiPartBody, contentType, urlProcessor, bodyHeadersProcessor) {
    let match = contentType.match(/^multipart\/mixed;[ ]?boundary=(.*)$/i);
    let boundary = match && match.pop();
    if (!boundary) {
        return multiPartBody;
    }
    let boundaryChangeSet = '';
    let urlAfterBlank = false;
    let bodyAfterBlank = false;
    let previousLineIsBlank = false;
    let index = 0;
    let statusCode;
    let contentId;
    let body = '';
    let headers = {};
    let method = '';
    let url = '';
    let parts = multiPartBody.split('\r\n');
    const newParts = [];
    parts.forEach(part => {
        let match = part.match(/^content-type:[ ]?multipart\/mixed;[ ]?boundary=(.*)$/i);
        if (match) {
            boundaryChangeSet = match.pop();
        }
        if (part.startsWith(`--${boundary}`) || (boundaryChangeSet && part.startsWith(`--${boundaryChangeSet}`))) {
            // Body & Headers
            if (bodyAfterBlank) {
                if (bodyHeadersProcessor) {
                    try {
                        const contentType = normalizeContentType(headers);
                        if (contentType === 'application/json') {
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
                        body = (result && result.body) || result;
                        headers = (result && result.headers) || headers;
                    } catch (err) {
                        // Error
                        console.log(err);
                        req.loggingContext.getTracer('Error').error(err.toString());
                    }
                }
                Object.entries(headers).forEach(([name, value]) => {
                    newParts.splice(-1, 0, `${name}: ${value}`);
                });
                newParts.push(body);
                statusCode = undefined;
                contentId = undefined;
                body = '';
                headers = {};
                url = '';
                index++;
            }
            urlAfterBlank = true;
            bodyAfterBlank = false;
            newParts.push(part);
            if (boundaryChangeSet && part === `--${boundaryChangeSet}--`) {
                boundaryChangeSet = '';
            }
        } else if (urlAfterBlank && previousLineIsBlank) {
            urlAfterBlank = false;
            bodyAfterBlank = true;
            // Url
            if (urlProcessor) {
                const urlParts = part.split(' ');
                const result = urlProcessor({method: urlParts[0], url: urlParts[1], contentId});
                urlParts[0] = (result && result.method) || urlParts[0];
                urlParts[1] = (result && result.url) || result;
                method = urlParts[0];
                url = urlParts[1];
                part = urlParts.join(' ');
            }
            newParts.push(part);
            if (part.startsWith('HTTP/')) {
                const statusCodeMatch = part.match(/^HTTP\/[\d.]+\s+(\d{3})\s.*$/i);
                if (statusCodeMatch) {
                    statusCode = statusCodeMatch.pop();
                }
            }
        } else if (bodyAfterBlank && (previousLineIsBlank || body !== '')) {
            body = body ? `${body}\r\n${part}` : part;
        } else if (part !== '') {
            if (!bodyAfterBlank) {
                if (part.toLowerCase().startsWith('content-id:')) {
                    let colonIndex = part.indexOf(':');
                    if (colonIndex !== -1) {
                        contentId = part.substr(colonIndex + 1).trim();
                    }
                }
                newParts.push(part);
            } else {
                let colonIndex = part.indexOf(':');
                if (colonIndex !== -1) {
                    headers[part.substr(0, colonIndex).toLowerCase()] = part.substr(colonIndex + 1).trim();
                }
            }
        } else {
            newParts.push(part);
        }
        previousLineIsBlank = part === '';
    });
    return newParts.join('\r\n');
}

function traceRequest(req, name, method, url, body) {
    req.loggingContext.getTracer(name).info(`${method} ${url}${method !== 'GET' ? '\n' + (typeof body === 'string' ? body : JSON.stringify(body)) : ''}`);
}

function traceResponse(req, name, headers, body) {
    req.loggingContext.getTracer(name).info(`\n${JSON.stringify(headers)}\n${typeof body === 'string' ? body : JSON.stringify(body)}`);
}
