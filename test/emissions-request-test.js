"use strict";

const supertest = require("supertest");

const env = require("./_env");
const util = require("./_env/util");

let request;

describe("emissions-request", () => {
  beforeAll(async () => {
    const context = await env("emissionsmodel", 0);
    request = supertest(context.app);
  });

  afterAll(async () => {
    await env.end();
  });

  it("GET emissions", async () => {
    const response = await util.callRead(request, "/v2/emissions-calculator/UserPreferences", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        results: [
          {
            LOCATION: "ImportData",
            NAME: "CSV_DECIMAL_SEPARATOR",
            TYPE: "LOCAL",
            VALUE: ".",
            __metadata: {
              type: "userData.EmissionsCalculatorService.UserPreferences",
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/emissions-calculator/UserPreferences()`,
            },
          },
          {
            LOCATION: "ImportData",
            NAME: "CSV_DECIMAL_SEPARATOR",
            TYPE: "LOCAL",
            VALUE: ";",
            __metadata: {
              type: "userData.EmissionsCalculatorService.UserPreferences",
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/emissions-calculator/UserPreferences()`,
            },
          },
        ],
      },
    });
  });
});
