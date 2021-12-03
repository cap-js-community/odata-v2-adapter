import {RequestHandler} from "express";

/**
 * CDS OData V2 Adapter Proxy
 * @param {Options} options CDS OData V2 Adapter Proxy options
 * @return {RequestHandler} CDS OData V2 Adapter Proxy Express RequestHandler
 */
export default function cov2ap(options?: Options): RequestHandler;

/**
 * CDS OData V2 Adapter Proxy options
 */
type Options = {

    /**
     * Base path under which the service is reachable. Default is ''.
     */
    base?: string | "",

    /**
     * Path under which the proxy is reachable. Default is 'v2'.
     */
    path?: string | "v2",

    /**
     * CDS service model (path(s) or CSN). Default is 'all'.
     */
    model?: string | string[] | object | "all",

    /**
     * Target port, which points to OData V4 backend port. Default is process.env.PORT or 4004
     */
    port?: number | 4004,

    /**
     * Target, which points to OData V4 backend host/port. Default is e.g. 'http://localhost:4004'
     */
    target?: string | "http://localhost:4004",

    /**
     * Target path to which is redirected. Default is ''.
     */
    targetPath?: string | "",

    /**
     * Service mapping object from url path name to service name. Default is {}.
     */
    services?: [string, string] | object | {},

    /**
     * CDS model is retrieved remotely via MTX endpoint for multitenant scenario. Default is false.
     */
    mtxRemote?: boolean | false,

    /**
     * Endpoint to retrieve MTX metadata when option 'mtxRemote' is active. Default is '/mtx/v1'.
     */
    mtxEndpoint?: string | "/mtx/v1",

    /**
     * `Edm.Decimal` and `Edm.Int64` are serialized IEEE754 compatible. Default is true.
     */
    ieee754Compatible?: boolean | true,

    /**
     *  Disable networking logging. Default is true.
     */
    disableNetworkLog?: boolean | true,

    /**
     * File upload file size limit (in bytes). Default is 10485760 (10 MB).
     */
    fileUploadSizeLimit?: number | 10485760,

    /**
     * Indicates to OData V4 backend to continue on error. Default is false.
     */
    continueOnError?: boolean | false,

    /**
     * Use ISO 8601 format for type cds.Time (Edm.Time). Default is false.
     */
    isoTime?: boolean | false,

    /**
     * Use ISO 8601 format for type cds.Date (Edm.DateTime). Default is false.
     */
    isoDate?: boolean | false,

    /**
     * Use ISO 8601 format for type cds.DateTime (Edm.DateTimeOffset). Default is false.
     */
    isoDateTime?: boolean | false,

    /**
     * Use ISO 8601 format for type cds.Timestamp (Edm.DateTimeOffset). Default is false.
     */
    isoTimestamp?: boolean | false,

    /**
     * Use ISO 8601 format for type Edm.DateTimeOffset (cds.DateTime, cds.Timestamp). Default is false.
     */
    isoDateTimeOffset?: boolean | false,

    /**
     * Request and response body parser size limit. Default is '100mb'.
     */
    bodyParserLimit?: string | "100mb",

    /**
     * Collection of entity type is returned nested into a `results` section. Default is `true`.
     */
    returnCollectionNested?: boolean | true,

    /**
     * Function import return structure of complex type (non collection) is nested using function import name. Default is `true`.
     */
    returnComplexNested?: boolean | true,

    /**
     * Function import return structure of primitive type (non collection) is nested using function import name. Default is `true`.
     */
    returnPrimitiveNested?: boolean | true,

    /**
     * Function import return value of primitive type is rendered as plain JSON value. Default is `true`.
     */
    returnPrimitivePlain?: boolean | true,

    /**
     * Specifies the message target default, if target is undefined. Default is `/#TRANSIENT#`.
     */
    messageTargetDefault?: string | "/#TRANSIENT#",

    /**
     * Transforms search functions i.e. substringof, startswith, endswith to case insensitive variant. Default is `false`
     */
    caseInsensitive?: boolean | false,

    /**
     * Propagates root error or message always to details section. Default is `false`.
     */
    propagateMessageToDetails?: boolean | false,

    /**
     * Default content disposition for media streams (inline, attachment). Default is `attachment`.
     */
    contentDisposition?: String | "attachment",

    /**
     * Specifies if search expression is quoted automatically. Default is `true`.
     */
    quoteSearch?: boolean | true
};