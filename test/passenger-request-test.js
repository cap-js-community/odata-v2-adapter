"use strict";

const supertest = require("supertest");

const env = require("./_env");
const util = require("./_env/util");

let request;

describe("passenegers-request", () => {
  beforeAll(async () => {
    const context = await env("passengermodel", 0);
    request = supertest(context.app);
  });

  afterAll(async () => {
    await env.end();
  });

  it("GET passenger transportation", async () => {
    const response = await util.callRead(
      request,
      "/v2/passenger-transportation/CalculationFactors(TRANSPORT_MODE_KEY='Company_Car',DIMENSION='DEFAULT',CLASS='DEFAULT',COUNTRY_OF_TRIP='DEFAULT',CURRENCY='DEFAULT',ALLOCATION_METHOD='KM',VALID_FROM=datetime'2000-01-02T00:00',VALID_TO=datetime'4000-01-02T00:00')",
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
        VALID_FROM: "/Date(946771200000)/",
        VALID_TO: "/Date(64060675200000)/",
        __metadata: {
          type: "passenger.PassengerTransportationService.CalculationFactors",
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost"
          )}/v2/passenger-transportation/CalculationFactors(TRANSPORT_MODE_KEY='Company_Car',DIMENSION='DEFAULT',CLASS='DEFAULT',COUNTRY_OF_TRIP='DEFAULT',CURRENCY='DEFAULT',ALLOCATION_METHOD='KM',VALID_FROM=datetime'2000-01-02T00:00',VALID_TO=datetime'4000-01-02T00:00')`,
        },
      },
    });
  });
});
