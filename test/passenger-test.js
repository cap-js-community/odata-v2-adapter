"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");

const util = require("./_env/util/request");

cds.test(__dirname + "/_env");

let request;

describe("passenger", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app);
  });

  it("GET passenger transportation", async () => {
    const response = await util.callRead(
      request,
      "/v2/passenger-transportation/CalculationFactors(TRANSPORT_MODE_KEY='Company_Car',DIMENSION='DEFAULT',CLASS='DEFAULT',COUNTRY_OF_TRIP='DEFAULT',CURRENCY='DEFAULT',ALLOCATION_METHOD='KM',VALID_FROM='2000-01-02',VALID_TO='4000-01-02')",
      {
        accept: "application/json",
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        ALLOCATION_METHOD: "KM",
        CLASS: "DEFAULT",
        COUNTRY_OF_TRIP: "DEFAULT",
        CURRENCY: "DEFAULT",
        DIMENSION: "DEFAULT",
        TRANSPORT_MODE_KEY: "Company_Car",
        VALID_FROM: "2000-01-02",
        VALID_TO: "4000-01-02",
        __metadata: {
          type: "passenger.PassengerTransportationService.CalculationFactors",
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost"
          )}/v2/passenger-transportation/CalculationFactors(TRANSPORT_MODE_KEY='Company_Car',DIMENSION='DEFAULT',CLASS='DEFAULT',COUNTRY_OF_TRIP='DEFAULT',CURRENCY='DEFAULT',ALLOCATION_METHOD='KM',VALID_FROM='2000-01-02',VALID_TO='4000-01-02')`,
        },
      },
    });
  });
});
