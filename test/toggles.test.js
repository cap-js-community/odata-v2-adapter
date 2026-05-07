"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");

const util = require("./_env/util/request");

cds.env.cov2ap = cds.env.cov2ap || {};
cds.env.cov2ap.toggles = true;

cds.on("listening", () => {
  delete cds.cov2ap.before;
});

cds.test(__dirname + "/_env");

let request;
let initialBeforeRoutes;

describe("toggles", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app.server);
    initialBeforeRoutes = cds.cov2ap.before;
  });

  afterEach(() => {
    cds.cov2ap.before = null;
  });

  describe("normalize before routes with toggles enabled", () => {
    it("Populates before routes with CDS middlewares and feature toggle middleware", () => {
      expect(initialBeforeRoutes).toBeDefined();
      expect(Array.isArray(initialBeforeRoutes)).toBe(true);
      expect(initialBeforeRoutes.length).toBeGreaterThan(0);
    });

    it("Inserts feature toggle middleware before ctx_model", () => {
      const ctxModelIndex = initialBeforeRoutes.findIndex((mw) => mw.factory === cds.middlewares.ctx_model);
      expect(ctxModelIndex).toBeGreaterThan(0);
      const featureToggleMw = initialBeforeRoutes[ctxModelIndex - 1];
      expect(typeof featureToggleMw).toBe("function");
      expect(featureToggleMw.factory).toBeUndefined();
    });

    it("Propagates cds.context.features to req.features", async () => {
      const features = { feat1: true, feat2: true };
      let capturedFeatures;
      cds.cov2ap.before = [
        function (req, _, next) {
          cds.context = { features };
          next();
        },
        function (req, _, next) {
          req.features ??= cds.context?.features;
          next();
        },
        function (req, _, next) {
          capturedFeatures = req.features;
          next();
        },
      ];
      const response = await util.callRead(request, "/odata/v2/main", {
        accept: "application/json",
      });
      expect(response.status).toEqual(200);
      expect(capturedFeatures).toEqual(features);
    });
  });

  describe("route before request execution", () => {
    it("Executes single before middleware function", async () => {
      cds.cov2ap.before = [
        function (req, res, next) {
          res.setHeader("x-test-before", "executed");
          next();
        },
      ];
      const response = await util.callRead(request, "/odata/v2/main", {
        accept: "application/json",
      });
      expect(response.status).toEqual(200);
      expect(response.headers["x-test-before"]).toEqual("executed");
    });

    it("Executes multiple before middleware functions in order", async () => {
      const order = [];
      cds.cov2ap.before = [
        function (req, res, next) {
          order.push("first");
          res.setHeader("x-test-order", "1");
          next();
        },
        function (req, res, next) {
          order.push("second");
          res.setHeader("x-test-order", res.getHeader("x-test-order") + ",2");
          next();
        },
        function (req, res, next) {
          order.push("third");
          res.setHeader("x-test-order", res.getHeader("x-test-order") + ",3");
          next();
        },
      ];
      const response = await util.callRead(request, "/odata/v2/main", {
        accept: "application/json",
      });
      expect(response.status).toEqual(200);
      expect(response.headers["x-test-order"]).toEqual("1,2,3");
      expect(order).toEqual(["first", "second", "third"]);
    });

    it("Handles error in before middleware", async () => {
      cds.cov2ap.before = [
        function (req, res, next) {
          next(new Error("before middleware error"));
        },
      ];
      const response = await util.callRead(request, "/odata/v2/main", {
        accept: "application/json",
      });
      expect(response.status).toEqual(500);
    });

    it("Handles thrown error in before middleware", async () => {
      cds.cov2ap.before = [
        function () {
          throw new Error("thrown error");
        },
      ];
      const response = await util.callRead(request, "/odata/v2/main", {
        accept: "application/json",
      });
      expect(response.status).toEqual(500);
    });

    it("Skips before middleware when array is empty", async () => {
      cds.cov2ap.before = [];
      const response = await util.callRead(request, "/odata/v2/main", {
        accept: "application/json",
      });
      expect(response.status).toEqual(200);
      expect(response.body.d).toBeDefined();
    });

    it("Stops middleware chain on error and does not execute subsequent middlewares", async () => {
      const executed = [];
      cds.cov2ap.before = [
        function (req, res, next) {
          executed.push("first");
          next();
        },
        function (req, res, next) {
          executed.push("second");
          next(new Error("stop here"));
        },
        function (req, res, next) {
          executed.push("third");
          next();
        },
      ];
      const response = await util.callRead(request, "/odata/v2/main", {
        accept: "application/json",
      });
      expect(response.status).toEqual(500);
      expect(executed).toEqual(["first", "second"]);
    });
  });
});
