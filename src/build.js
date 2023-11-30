"use strict";

const cds = require("@sap/cds");

const { path } = cds.utils;

module.exports = class COV2APBuildPlugin extends cds.build.BuildPlugin {
  static hasTask() {
    return cds.env.cov2ap && cds.env.cov2ap.plugin;
  }

  init() {
    const mtxBuildTask = this.context.tasks.find(task => task.for === "mtx-sidecar");
    this.mtxSidecar = !!mtxBuildTask;
    if (!this.mtxSidecar) {
      return;
    }
    this.task.src = mtxBuildTask.src;
    const sidecarEnv = cds.env.for("cds", mtxBuildTask.src);
    const modelProviderService = sidecarEnv.requires["cds.xt.ModelProviderService"];
    this.task.dest = path.join(mtxBuildTask.dest, modelProviderService.root, cds.env.folders.srv, "odata/v2");
  }

  async build() {
    if (!this.mtxSidecar) {
      return;
    }
    const model = await this.model(); // TODO: Use this.baseModel(), when available
    if (!model) {
      return;
    }
    const services = cds.reflect(model).services.filter((service) => this.isServedViaOData(service));
    for (const service of services) {
      if (model.definitions && model.definitions[service.name] && model.definitions[service.name]["@cov2ap.ignore"]) {
        continue;
      }
      try {
        const result = await cds.compile.to.edmx(model, {
          service: service.name,
          version: "v2",
        });
        this.write(result).to(`${service.name}.xml`);
      } catch (err) {
        this._logger.info(
          `EDMX V2 compilation failed. Service '${service.name}' is (probably) not compatible with OData V2`,
          err,
        );
      }
    }
  }

  isServedViaOData(service) {
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
};
