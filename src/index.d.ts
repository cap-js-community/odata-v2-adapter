import { RequestHandler } from "express";

/**
 * OData V2 adapter for CDS
 * @param {Options} options OData V2 adapter for CDS options
 * @return {RequestHandler} OData V2 adapter for CDS Express RequestHandler
 */
export default function cov2ap(options?: Options): RequestHandler;

/**
 * OData V2 adapter for CDS options
 */
type Options = {
  /**
   * Base path under which the service is reachable. Default is ''.
   */
  base?: string | "";

  /**
   * Path under which the service is reachable. Default is `'odata/v2'`. Default path is `'v2'` for CDS <7 or `middlewares` deactivated.
   */
  path?: string | "odata/v2";

  /**
   * CDS service model (path(s) or CSN). Default is 'all'.
   */
  model?: string | string[] | object | "all";

  /**
   * Target port which points to OData V4 backend port. Default is process.env.PORT or 4004.
   */
  port?: number | 4004;

  /**
   * Target which points to OData V4 backend host:port. Use 'auto' to infer the target from server url after listening. Default is e.g. 'auto'.
   */
  target?: string | "auto" | "http://localhost:4004";

  /**
   * Target path to which is redirected. Default is `'odata/v4'`. Default path is `''` for CDS <7 or `middlewares` deactivated.
   */
  targetPath?: string | "odata/v4";

  /**
   * Service mapping object from url path name to service name. Default is {}.
   */
  services?: [string, string] | object;

  /**
   * CDS model is retrieved remotely via MTX endpoint for multitenant scenario (old MTX only). Default is false.
   */
  mtxRemote?: boolean | false;

  /**
   * Endpoint to retrieve MTX metadata when option 'mtxRemote' is active (old MTX only). Default is '/mtx/v1'.
   */
  mtxEndpoint?: string | "/mtx/v1";

  /**
   * Edm.Decimal and Edm.Int64 are serialized IEEE754 compatible. Default is true.
   */
  ieee754Compatible?: boolean | true;

  /**
   * File upload file size limit (in bytes) for multipart/form-data requests. Default is 10485760 (10 MB).
   */
  fileUploadSizeLimit?: number | 10485760;

  /**
   * Indicates to OData V4 backend to continue on error. Default is false.
   */
  continueOnError?: boolean | false;

  /**
   * Use ISO 8601 format for type cds.Time (Edm.Time). Default is false.
   */
  isoTime?: boolean | false;

  /**
   * Use ISO 8601 format for type cds.Date (Edm.DateTime). Default is false.
   */
  isoDate?: boolean | false;

  /**
   * Use ISO 8601 format for type cds.DateTime (Edm.DateTimeOffset). Default is false.
   */
  isoDateTime?: boolean | false;

  /**
   * Use ISO 8601 format for type cds.Timestamp (Edm.DateTimeOffset). Default is false.
   */
  isoTimestamp?: boolean | false;

  /**
   * Use ISO 8601 format for type Edm.DateTimeOffset (cds.DateTime, cds.Timestamp). Default is false.
   */
  isoDateTimeOffset?: boolean | false;

  /**
   * Request and response body parser size limit. Default is '100mb'.
   */
  bodyParserLimit?: string | "100mb";

  /**
   * Collection of entity type is returned nested into a results section. Default is true.
   */
  returnCollectionNested?: boolean | true;

  /**
   * Function import return structure of complex type (non collection) is nested using function import name. Default is true.
   */
  returnComplexNested?: boolean | true;

  /**
   * Function import return structure of primitive type (non collection) is nested using function import name. Default is true.
   */
  returnPrimitiveNested?: boolean | true;

  /**
   * Function import return value of primitive type is rendered as plain JSON value. Default is true.
   */
  returnPrimitivePlain?: boolean | true;

  /**
   * Specifies the message target default, if target is undefined. Default is '/#TRANSIENT#'.
   */
  messageTargetDefault?: string | "/#TRANSIENT#";

  /**
   * Transforms search functions i.e. substringof, startswith, endswith to case-insensitive variant. Default is false.
   */
  caseInsensitive?: boolean | false;

  /**
   * Propagates root error or message always to details section. Default is false.
   */
  propagateMessageToDetails?: boolean | false;

  /**
   * Default content disposition for media streams (inline, attachment), if not available or calculated. Default is 'attachment'.
   */
  contentDisposition?: string | "attachment" | "inline";

  /**
   * Calculate content disposition for media streams even if already available. Default is false.
   */
  calcContentDisposition?: boolean | false;

  /**
   * Specifies if search expression is quoted automatically. Default is true.
   */
  quoteSearch?: boolean | true;

  /**
   * Specifies if unsupported draft requests are converted to a working version. Default is false.
   */
  fixDraftRequests?: boolean | false;

  /**
   * Log level of batch changeset content-id deviation logs (none, debug, info, warn, error). Default is 'info'.
   */
  changesetDeviationLogLevel?: string | "info";

  /**
   * Specifies the default entity response format (json, atom). Default is 'json'.
   */
  defaultFormat?: string | "json";

  /**
   * Specifies if 'x-forwarded' headers are processed. Default is 'true'.
   */
  processForwardedHeaders?: boolean | true;

  /**
   * Specifies if the definition elements are cached. Default is 'true'.
   */
  cacheDefinitions?: boolean | true;

  /**
   * Specifies the caching and provisioning strategy of metadata (e.g. edmx) (memory, disk, stream). Default is 'memory'.
   */
  cacheMetadata?: string | "memory" | "disk" | "stream";
};
