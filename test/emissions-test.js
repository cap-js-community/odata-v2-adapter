"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");

const util = require("./_env/util/request");

cds.test(__dirname + "/_env");

let request;

describe("emissions", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app);
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
