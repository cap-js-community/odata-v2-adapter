"use strict";

const cds = require("@sap/cds");

const { path } = cds.utils;

module.exports = class COV2APBuildPlugin extends cds.build.BuildPlugin {
  static hasTask() {
    return cds.env.cov2ap && cds.env.cov2ap.plugin;
  }

  async build() {
    const sidecarEnv = cds.env.for("cds", this.task.src);
    const modelProviderService = sidecarEnv.requires["cds.xt.ModelProviderService"];
    const main = (modelProviderService && modelProviderService.root) || "_main"; // TODO: why root not _main
    const destRoot = path.join(this.task.dest, "mtx/sidecar"); // TODO: how to get dest already on mtx/sidecar
    const destMain = path.join(destRoot, main);
    const destMainSrv = path.join(destMain, cds.env.folders.srv);
    const model = await this.model();
    if (!model) {
      return;
    }
    const services = cds.reflect(model).services.filter((service) => this.isServedViaOData(service));
    for (const service of services) {
      try {
        const result = await cds.compile.to.edmx(model, {
          service: service.name,
          version: "v2",
        });
        this.write(result).to(path.join(destMainSrv, "odata/v2", `${service.name}.xml`));
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
