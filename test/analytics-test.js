"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");

const util = require("./_env/util/request");

cds.test(__dirname + "/_env");

let request;

describe("analytics", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app.server);
  });

  it("GET $metadata", async () => {
    const response = await util.callRead(request, "/v2/analytics/$metadata", {
      accept: "application/xml",
    });
    expect(response.body).toBeDefined();
    expect(response.text).toMatchSnapshot();
  });

  it("GET request on entity with @cov2ap.analytics: false", async () => {
    let response = await util.callRead(request, "/v2/analytics/HeaderDisabledAnalytics?$select=currency,stock");
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    expect(response.body.d.results).toBeDefined();
    // no aggregation should have happened
    expect(response.body.d.results.length).toEqual(7);
  });

  it("GET request with grouping and aggregation", async () => {
    let response = await util.callRead(request, "/v2/analytics/Header?$select=currency,stock");
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        results: [
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{"currency":"'ABC'"},"value":["currency","stock"]}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{"currency":"\'ABC\'"},"value":["currency","stock"]}\'',
            currency: "ABC",
            stock: 1,
          },
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{"currency":"'CHF'"},"value":["currency","stock"]}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{"currency":"\'CHF\'"},"value":["currency","stock"]}\'',
            currency: "CHF",
            stock: 11,
          },
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{"currency":"'EUR'"},"value":["currency","stock"]}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{"currency":"\'EUR\'"},"value":["currency","stock"]}\'',
            currency: "EUR",
            stock: 25,
          },
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{"currency":"'U%2FSD'"},"value":["currency","stock"]}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{"currency":"\'U%2FSD\'"},"value":["currency","stock"]}\'',
            currency: "U/SD",
            stock: 99,
          },
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{"currency":"'USD'"},"value":["currency","stock"]}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{"currency":"\'USD\'"},"value":["currency","stock"]}\'',
            currency: "USD",
            stock: 17,
          },
        ],
      },
    });
    response = await util.callRead(
      request,
      `/v2/analytics/Header(aggregation'{"key":{"currency":"'USD'"},"value":["currency","stock"]}')`
    );
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        __metadata: {
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost"
          )}/v2/analytics/Header(aggregation'{"key":{"currency":"'USD'"},"value":["currency","stock"]}')`,
          type: "test.AnalyticsService.Header",
        },
        ID__: 'aggregation\'{"key":{"currency":"\'USD\'"},"value":["currency","stock"]}\'',
        currency: "USD",
        stock: 17,
      },
    });
    response = await util.callRead(
      request,
      `/v2/analytics/Header(aggregation'{"key":{"currency":"'U%2FSD'"},"value":["currency","stock"]}')`
    );
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        __metadata: {
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost"
          )}/v2/analytics/Header(aggregation'{"key":{"currency":"'U%2FSD'"},"value":["currency","stock"]}')`,
          type: "test.AnalyticsService.Header",
        },
        ID__: 'aggregation\'{"key":{"currency":"\'U%2FSD\'"},"value":["currency","stock"]}\'',
        currency: "U/SD",
        stock: 99,
      },
    });
  });

  it("GET request with grouping and aggregating many", async () => {
    const response = await util.callRead(request, "/v2/analytics/Header?$select=country,currency,stock,price");
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        results: [
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{"country":"'Germany'","currency":"'EUR'"},"value":["country","currency","stock","price"]}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{"country":"\'Germany\'","currency":"\'EUR\'"},"value":["country","currency","stock","price"]}\'',
            country: "Germany",
            currency: "EUR",
            stock: 10,
            price: "12.12",
          },
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{"country":"'New%20%22Jersey'","currency":"'ABC'"},"value":["country","currency","stock","price"]}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{"country":"\'New%20%22Jersey\'","currency":"\'ABC\'"},"value":["country","currency","stock","price"]}\'',
            country: 'New "Jersey',
            currency: "ABC",
            stock: 1,
            price: "1.23",
          },
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{"country":"'New%20York'","currency":"'U%2FSD'"},"value":["country","currency","stock","price"]}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{"country":"\'New%20York\'","currency":"\'U%2FSD\'"},"value":["country","currency","stock","price"]}\'',
            country: "New York",
            currency: "U/SD",
            stock: 99,
            price: "9.99",
          },
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{"country":"'Spain'","currency":"'EUR'"},"value":["country","currency","stock","price"]}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{"country":"\'Spain\'","currency":"\'EUR\'"},"value":["country","currency","stock","price"]}\'',
            country: "Spain",
            currency: "EUR",
            stock: 15,
            price: "11.11",
          },
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{"country":"'Switzerland'","currency":"'CHF'"},"value":["country","currency","stock","price"]}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{"country":"\'Switzerland\'","currency":"\'CHF\'"},"value":["country","currency","stock","price"]}\'',
            country: "Switzerland",
            currency: "CHF",
            stock: 11,
            price: "12.34",
          },
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{"country":"'Texas'","currency":"'USD'"},"value":["country","currency","stock","price"]}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{"country":"\'Texas\'","currency":"\'USD\'"},"value":["country","currency","stock","price"]}\'',
            country: "Texas",
            currency: "USD",
            stock: 17,
            price: "10.165000000000001",
          },
        ],
      },
    });
  });

  it("GET request with grouping and aggregation and order by", async () => {
    const response = await util.callRead(
      request,
      "/v2/analytics/Header?$select=currency,stock&$top=5&$orderby=stock asc"
    );
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        results: [
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{"currency":"'ABC'"},"value":["currency","stock"]}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{"currency":"\'ABC\'"},"value":["currency","stock"]}\'',
            currency: "ABC",
            stock: 1,
          },
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{"currency":"'CHF'"},"value":["currency","stock"]}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{"currency":"\'CHF\'"},"value":["currency","stock"]}\'',
            currency: "CHF",
            stock: 11,
          },
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{"currency":"'USD'"},"value":["currency","stock"]}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{"currency":"\'USD\'"},"value":["currency","stock"]}\'',
            currency: "USD",
            stock: 17,
          },
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{"currency":"'EUR'"},"value":["currency","stock"]}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{"currency":"\'EUR\'"},"value":["currency","stock"]}\'',
            currency: "EUR",
            stock: 25,
          },
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{"currency":"'U%2FSD'"},"value":["currency","stock"]}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{"currency":"\'U%2FSD\'"},"value":["currency","stock"]}\'',
            currency: "U/SD",
            stock: 99,
          },
        ],
      },
    });
  });

  it("GET request with grouping and aggregation and filter", async () => {
    let response = await util.callRead(
      request,
      "/v2/analytics/Header?$select=stock,currency&$top=4&$filter=currency eq 'USD'"
    );
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        results: [
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{"currency":"'USD'"},"value":["stock","currency"],"filter":"currency%20eq%20'USD'"}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{"currency":"\'USD\'"},"value":["stock","currency"],"filter":"currency%20eq%20\'USD\'"}\'',
            currency: "USD",
            stock: 17,
          },
        ],
      },
    });
    response = await util.callRead(
      request,
      '/v2/analytics/Header(aggregation\'{"key":{"currency":"\'USD\'"},"value":["stock","currency"],"filter":"currency%20eq%20\'USD\'"}\')'
    );
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        __metadata: {
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost"
          )}/v2/analytics/Header(aggregation'{"key":{"currency":"'USD'"},"value":["stock","currency"],"filter":"currency%20eq%20'USD'"}')`,
          type: "test.AnalyticsService.Header",
        },
        ID__: 'aggregation\'{"key":{"currency":"\'USD\'"},"value":["stock","currency"],"filter":"currency%20eq%20\'USD\'"}\'',
        currency: "USD",
        stock: 17,
      },
    });

    response = await util.callRead(
      request,
      "/v2/analytics/Header?$select=stock,currency&$top=4&$filter=(currency eq 'USD' or currency eq 'EUR')"
    );
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        results: [
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{"currency":"'EUR'"},"value":["stock","currency"],"filter":"(currency%20eq%20'USD'%20or%20currency%20eq%20'EUR')"}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{"currency":"\'EUR\'"},"value":["stock","currency"],"filter":"(currency%20eq%20\'USD\'%20or%20currency%20eq%20\'EUR\')"}\'',
            currency: "EUR",
            stock: 25,
          },
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{"currency":"'USD'"},"value":["stock","currency"],"filter":"(currency%20eq%20'USD'%20or%20currency%20eq%20'EUR')"}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{"currency":"\'USD\'"},"value":["stock","currency"],"filter":"(currency%20eq%20\'USD\'%20or%20currency%20eq%20\'EUR\')"}\'',
            currency: "USD",
            stock: 17,
          },
        ],
      },
    });
    response = await util.callRead(
      request,
      '/v2/analytics/Header(aggregation\'{"key":{"currency":"\'EUR\'"},"value":["stock","currency"],"filter":"(currency%20eq%20\'USD\'%20or%20currency%20eq%20\'EUR\')"}\')'
    );
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        __metadata: {
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost"
          )}/v2/analytics/Header(aggregation'{"key":{"currency":"'EUR'"},"value":["stock","currency"],"filter":"(currency%20eq%20'USD'%20or%20currency%20eq%20'EUR')"}')`,
          type: "test.AnalyticsService.Header",
        },
        ID__: 'aggregation\'{"key":{"currency":"\'EUR\'"},"value":["stock","currency"],"filter":"(currency%20eq%20\'USD\'%20or%20currency%20eq%20\'EUR\')"}\'',
        currency: "EUR",
        stock: 25,
      },
    });
    response = await util.callRead(
      request,
      '/v2/analytics/Header(aggregation\'{"key":{"currency":"\'USD\'"},"value":["stock","currency"],"filter":"(currency%20eq%20\'USD\'%20or%20currency%20eq%20\'EUR\')"}\')'
    );
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        __metadata: {
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost"
          )}/v2/analytics/Header(aggregation'{"key":{"currency":"'USD'"},"value":["stock","currency"],"filter":"(currency%20eq%20'USD'%20or%20currency%20eq%20'EUR')"}')`,
          type: "test.AnalyticsService.Header",
        },
        ID__: 'aggregation\'{"key":{"currency":"\'USD\'"},"value":["stock","currency"],"filter":"(currency%20eq%20\'USD\'%20or%20currency%20eq%20\'EUR\')"}\'',
        currency: "USD",
        stock: 17,
      },
    });
  });

  it("GET request with aggregation and filter element not selected", async () => {
    let response = await util.callRead(request, "/v2/analytics/Header?$select=stock&$top=4&$filter=currency eq 'USD'");
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        results: [
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{},"value":["stock"],"filter":"currency%20eq%20'USD'"}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{},"value":["stock"],"filter":"currency%20eq%20\'USD\'"}\'',
            stock: 17,
          },
        ],
      },
    });
    response = await util.callRead(
      request,
      '/v2/analytics/Header(aggregation\'{"key":{},"value":["stock"],"filter":"currency%20eq%20\'USD\'"}\')'
    );
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        __metadata: {
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost"
          )}/v2/analytics/Header(aggregation'{"key":{},"value":["stock"],"filter":"currency%20eq%20'USD'"}')`,
          type: "test.AnalyticsService.Header",
        },
        ID__: 'aggregation\'{"key":{},"value":["stock"],"filter":"currency%20eq%20\'USD\'"}\'',
        stock: 17,
      },
    });

    response = await util.callRead(
      request,
      "/v2/analytics/Header?$select=stock&$top=4&$filter=(currency eq 'USD' or currency eq 'EUR')"
    );
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        results: [
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{},"value":["stock"],"filter":"(currency%20eq%20'USD'%20or%20currency%20eq%20'EUR')"}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{},"value":["stock"],"filter":"(currency%20eq%20\'USD\'%20or%20currency%20eq%20\'EUR\')"}\'',
            stock: 42,
          },
        ],
      },
    });
    response = await util.callRead(
      request,
      '/v2/analytics/Header(aggregation\'{"key":{},"value":["stock"],"filter":"(currency%20eq%20\'USD\'%20or%20currency%20eq%20\'EUR\')"}\')'
    );
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        __metadata: {
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost"
          )}/v2/analytics/Header(aggregation'{"key":{},"value":["stock"],"filter":"(currency%20eq%20'USD'%20or%20currency%20eq%20'EUR')"}')`,
          type: "test.AnalyticsService.Header",
        },
        ID__: 'aggregation\'{"key":{},"value":["stock"],"filter":"(currency%20eq%20\'USD\'%20or%20currency%20eq%20\'EUR\')"}\'',
        stock: 42,
      },
    });
  });

  it("GET request with grouping and aggregation combined with search", async () => {
    let response = await util.callRead(request, "/v2/analytics/Header?$select=stock&search=Header");
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      error: {
        code: "501",
        innererror: {
          errordetails: [
            {
              code: "501",
              message: {
                lang: "en",
                value: 'Feature is not supported: Transformation "10" with query option $apply',
              },
              severity: "error",
              target: "/#TRANSIENT#",
            },
          ],
        },
        message: {
          lang: "en",
          value: 'Feature is not supported: Transformation "10" with query option $apply',
        },
        severity: "error",
        target: "/#TRANSIENT#",
      },
    });
  });

  it("GET request with grouping and aggregation combined with search and filtering", async () => {
    let response = await util.callRead(
      request,
      "/v2/analytics/Header?$select=stock&$filter=currency eq 'USD'&search=Header"
    );
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      error: {
        code: "501",
        innererror: {
          errordetails: [
            {
              code: "501",
              message: {
                lang: "en",
                value: 'Feature is not supported: Transformation "10" with query option $apply',
              },
              severity: "error",
              target: "/#TRANSIENT#",
            },
          ],
        },
        message: {
          lang: "en",
          value: 'Feature is not supported: Transformation "10" with query option $apply',
        },
        severity: "error",
        target: "/#TRANSIENT#",
      },
    });
  });

  it("GET request with ID__", async () => {
    let response = await util.callRead(request, "/v2/analytics/Header?$select=currency,stock,ID__");
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        results: [
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{"currency":"'ABC'"},"value":["currency","stock"]}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{"currency":"\'ABC\'"},"value":["currency","stock"]}\'',
            currency: "ABC",
            stock: 1,
          },
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{"currency":"'CHF'"},"value":["currency","stock"]}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{"currency":"\'CHF\'"},"value":["currency","stock"]}\'',
            currency: "CHF",
            stock: 11,
          },
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{"currency":"'EUR'"},"value":["currency","stock"]}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{"currency":"\'EUR\'"},"value":["currency","stock"]}\'',
            currency: "EUR",
            stock: 25,
          },
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{"currency":"'U%2FSD'"},"value":["currency","stock"]}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{"currency":"\'U%2FSD\'"},"value":["currency","stock"]}\'',
            currency: "U/SD",
            stock: 99,
          },
          {
            __metadata: {
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/Header(aggregation'{"key":{"currency":"'USD'"},"value":["currency","stock"]}')`,
              type: "test.AnalyticsService.Header",
            },
            ID__: 'aggregation\'{"key":{"currency":"\'USD\'"},"value":["currency","stock"]}\'',
            currency: "USD",
            stock: 17,
          },
        ],
      },
    });
    response = await util.callRead(
      request,
      `/v2/analytics/Header(aggregation'{"key":{"currency":"'USD'"},"value":["currency","stock"]}')`
    );
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        __metadata: {
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost"
          )}/v2/analytics/Header(aggregation'{"key":{"currency":"'USD'"},"value":["currency","stock"]}')`,
          type: "test.AnalyticsService.Header",
        },
        ID__: 'aggregation\'{"key":{"currency":"\'USD\'"},"value":["currency","stock"]}\'',
        currency: "USD",
        stock: 17,
      },
    });
    response = await util.callRead(
      request,
      `/v2/analytics/Header('aggregation'{"key":{"currency":"'USD'"},"value":["currency","stock"]}'')`
    );
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        __metadata: {
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost"
          )}/v2/analytics/Header(aggregation'{"key":{"currency":"'USD'"},"value":["currency","stock"]}')`,
          type: "test.AnalyticsService.Header",
        },
        ID__: 'aggregation\'{"key":{"currency":"\'USD\'"},"value":["currency","stock"]}\'',
        currency: "USD",
        stock: 17,
      },
    });
    response = await util.callRead(
      request,
      `/v2/analytics/Header(ID__='aggregation'{"key":{"currency":"'USD'"},"value":["currency","stock"]}'')`
    );
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      d: {
        __metadata: {
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost"
          )}/v2/analytics/Header(aggregation'{"key":{"currency":"'USD'"},"value":["currency","stock"]}')`,
          type: "test.AnalyticsService.Header",
        },
        ID__: 'aggregation\'{"key":{"currency":"\'USD\'"},"value":["currency","stock"]}\'',
        currency: "USD",
        stock: 17,
      },
    });
  });

  it("GET request with COUNT_DISTINCT", async () => {
    const response = await util.callRead(request, "/v2/analytics/HeaderItemCount?$select=startAt,header");
    expect(response.body).toEqual({
      d: {
        results: [
          {
            ID__: 'aggregation\'{"key":{"startAt":"datetimeoffset\'%2FDate(1546300800000%2B0000)%2F\'"},"value":["startAt","header"]}\'',
            __metadata: {
              type: "test.AnalyticsService.HeaderItemCount",
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/HeaderItemCount(aggregation\'{"key":{"startAt":"datetimeoffset\'%2FDate(1546300800000%2B0000)%2F\'"},"value":["startAt","header"]}\')`,
            },
            header: "4",
            startAt: "/Date(1546300800000+0000)/",
          },
          {
            ID__: 'aggregation\'{"key":{"startAt":"datetimeoffset\'%2FDate(1577836800000%2B0000)%2F\'"},"value":["startAt","header"]}\'',
            __metadata: {
              type: "test.AnalyticsService.HeaderItemCount",
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/HeaderItemCount(aggregation\'{"key":{"startAt":"datetimeoffset\'%2FDate(1577836800000%2B0000)%2F\'"},"value":["startAt","header"]}\')`,
            },
            header: "4",
            startAt: "/Date(1577836800000+0000)/",
          },
          {
            ID__: 'aggregation\'{"key":{"startAt":"datetimeoffset\'%2FDate(1640995200000%2B0000)%2F\'"},"value":["startAt","header"]}\'',
            __metadata: {
              type: "test.AnalyticsService.HeaderItemCount",
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/HeaderItemCount(aggregation\'{"key":{"startAt":"datetimeoffset\'%2FDate(1640995200000%2B0000)%2F\'"},"value":["startAt","header"]}\')`,
            },
            header: "1",
            startAt: "/Date(1640995200000+0000)/",
          },
        ],
      },
    });
  });

  it("GET request with COUNT_DISTINCT and reference element and integer type", async () => {
    const response = await util.callRead(request, "/v2/analytics/HeaderItemCount?$select=startAt,header2");
    expect(response.body).toEqual({
      d: {
        results: [
          {
            ID__: 'aggregation\'{"key":{"startAt":"datetimeoffset\'%2FDate(1546300800000%2B0000)%2F\'"},"value":["startAt","header2"]}\'',
            __metadata: {
              type: "test.AnalyticsService.HeaderItemCount",
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/HeaderItemCount(aggregation\'{"key":{"startAt":"datetimeoffset\'%2FDate(1546300800000%2B0000)%2F\'"},"value":["startAt","header2"]}\')`,
            },
            header2: 4,
            startAt: "/Date(1546300800000+0000)/",
          },
          {
            ID__: 'aggregation\'{"key":{"startAt":"datetimeoffset\'%2FDate(1577836800000%2B0000)%2F\'"},"value":["startAt","header2"]}\'',
            __metadata: {
              type: "test.AnalyticsService.HeaderItemCount",
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/HeaderItemCount(aggregation\'{"key":{"startAt":"datetimeoffset\'%2FDate(1577836800000%2B0000)%2F\'"},"value":["startAt","header2"]}\')`,
            },
            header2: 4,
            startAt: "/Date(1577836800000+0000)/",
          },
          {
            ID__: 'aggregation\'{"key":{"startAt":"datetimeoffset\'%2FDate(1640995200000%2B0000)%2F\'"},"value":["startAt","header2"]}\'',
            __metadata: {
              type: "test.AnalyticsService.HeaderItemCount",
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/HeaderItemCount(aggregation\'{"key":{"startAt":"datetimeoffset\'%2FDate(1640995200000%2B0000)%2F\'"},"value":["startAt","header2"]}\')`,
            },
            header2: 1,
            startAt: "/Date(1640995200000+0000)/",
          },
        ],
      },
    });
  });

  it("GET request with COUNT", async () => {
    const response = await util.callRead(request, "/v2/analytics/HeaderItemCount?$select=startAt,header_count");
    expect(response.body).toEqual({
      d: {
        results: [
          {
            ID__: 'aggregation\'{"key":{"startAt":"datetimeoffset\'%2FDate(1546300800000%2B0000)%2F\'"},"value":["startAt","header_count"]}\'',
            __metadata: {
              type: "test.AnalyticsService.HeaderItemCount",
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/HeaderItemCount(aggregation\'{"key":{"startAt":"datetimeoffset\'%2FDate(1546300800000%2B0000)%2F\'"},"value":["startAt","header_count"]}\')`,
            },
            header_count: "4",
            startAt: "/Date(1546300800000+0000)/",
          },
          {
            ID__: 'aggregation\'{"key":{"startAt":"datetimeoffset\'%2FDate(1577836800000%2B0000)%2F\'"},"value":["startAt","header_count"]}\'',
            __metadata: {
              type: "test.AnalyticsService.HeaderItemCount",
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/HeaderItemCount(aggregation\'{"key":{"startAt":"datetimeoffset\'%2FDate(1577836800000%2B0000)%2F\'"},"value":["startAt","header_count"]}\')`,
            },
            header_count: "4",
            startAt: "/Date(1577836800000+0000)/",
          },
          {
            ID__: 'aggregation\'{"key":{"startAt":"datetimeoffset\'%2FDate(1640995200000%2B0000)%2F\'"},"value":["startAt","header_count"]}\'',
            __metadata: {
              type: "test.AnalyticsService.HeaderItemCount",
              uri: `http://${response.request.host.replace(
                "127.0.0.1",
                "localhost"
              )}/v2/analytics/HeaderItemCount(aggregation\'{"key":{"startAt":"datetimeoffset\'%2FDate(1640995200000%2B0000)%2F\'"},"value":["startAt","header_count"]}\')`,
            },
            header_count: "2",
            startAt: "/Date(1640995200000+0000)/",
          },
        ],
      },
    });
  });

  it("POST bound action on analytical entity", async () => {
    let response = await util.callRead(
      request,
      "/v2/analytics/Book?$select=author,genre_ID,price&$top=124&$inlinecount=allpages"
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    const ID__ = response.body.d.results[0].ID__;
    response = await util.callWrite(request, `/v2/analytics/Book_order?ID__=${ID__}&number=5`);
    expect(response.body.d).toMatchObject({
      author: "Catweazle",
      genre_ID: 1,
      stock: 5,
      description:
        'aggregation\'{"key":{"author":"\'Catweazle\'","genre_ID":"1"},"value":["author","genre_ID","price"]}\'',
      __metadata: {
        type: "test.AnalyticsService.Book",
        uri: `http://${response.request.host.replace(
          "127.0.0.1",
          "localhost"
        )}/v2/analytics/Book(author='Catweazle',genre_ID=1)`,
      },
    });
  });

  it("POST bound action on analytical entity with incomplete key", async () => {
    let response = await util.callRead(
      request,
      "/v2/analytics/Book?$select=author,price&$top=124&$inlinecount=allpages"
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    const ID__ = response.body.d.results[0].ID__;
    response = await util.callWrite(request, `/v2/analytics/Book_order?ID__=${ID__}&number=5`);
    expect(response.body).toMatchObject({
      error: {
        code: "400",
        message: {
          lang: "en",
          value: "No 'Edm.Int32' value found for key 'genre_ID'",
        },
        severity: "error",
        target: "/#TRANSIENT#",
        innererror: {
          errordetails: [
            {
              code: "400",
              message: {
                lang: "en",
                value: "No 'Edm.Int32' value found for key 'genre_ID'",
              },
              severity: "error",
              target: "/#TRANSIENT#",
            },
          ],
        },
      },
    });
  });

  it("POST bound action on analytical entity with whitespaces in key", async () => {
    let response = await util.callRead(
      request,
      "/v2/analytics/Book?$select=author,genre_ID,price&$top=124&$inlinecount=allpages"
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    const ID__ = response.body.d.results[0].ID__;
    response = await util.callWrite(
      request,
      `/v2/analytics/Book_order?ID__=${ID__.replace("Catweazle", "Cat weazle")}&number=5`
    );
    expect(response.body.d).toMatchObject({
      author: "Cat weazle",
      genre_ID: 1,
      stock: 5,
      description:
        'aggregation\'{"key":{"author":"\'Cat weazle\'","genre_ID":"1"},"value":["author","genre_ID","price"]}\'',
      __metadata: {
        type: "test.AnalyticsService.Book",
        uri: `http://${response.request.host.replace(
          "127.0.0.1",
          "localhost"
        )}/v2/analytics/Book(author='Cat%20weazle',genre_ID=1)`,
      },
    });
  });

  it("POST bound action on analytical entity with escaped ID__", async () => {
    let response = await util.callRead(
      request,
      "/v2/analytics/Book?$select=author,genre_ID,price&$top=124&$inlinecount=allpages"
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    const ID__ = response.body.d.results[0].ID__;
    response = await util.callWrite(request, `/v2/analytics/Book_order?ID__='${ID__.replace(/'/g, "''")}'&number=5`);
    expect(response.body.d).toMatchObject({
      author: "Catweazle",
      genre_ID: 1,
      stock: 5,
      description:
        'aggregation\'{"key":{"author":"\'Catweazle\'","genre_ID":"1"},"value":["author","genre_ID","price"]}\'',
      __metadata: {
        type: "test.AnalyticsService.Book",
        uri: `http://${response.request.host.replace(
          "127.0.0.1",
          "localhost"
        )}/v2/analytics/Book(author='Catweazle',genre_ID=1)`,
      },
    });
  });
});
