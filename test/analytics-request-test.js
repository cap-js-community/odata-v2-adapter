"use strict";

const fs = require("fs");
const supertest = require("supertest");

const env = require("./_env");
const util = require("./_env/util");
const init = require("./_env/data/init");

let context;
let request;

describe("analytics-request", () => {
  beforeAll(async () => {
    context = await env("analyticsmodel", 0, init);
    request = supertest(context.app);
  });

  afterAll(() => {
    env.end(context);
  });

  it("GET request on entity with @cov2ap.analytics: false", async () => {
    let response = await util.callRead(request, "/v2/analytics/HeaderDisabledAnalytics?$select=currency,stock");
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    expect(response.body.d.results).toBeDefined();
    // no aggregation should have happened
    expect(response.body.d.results.length).toEqual(5);
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
              )}/v2/analytics/Header(aggregation'{"key":{"currency":"'EUR'"},"value":["currency","stock"]}')`,
              type: "test.AnalyticsService.Header",
            },
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
              )}/v2/analytics/Header(aggregation'{"key":{"country":"'New%20York'","currency":"'U%2FSD'"},"value":["country","currency","stock","price"]}')`,
              type: "test.AnalyticsService.Header",
            },
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
              )}/v2/analytics/Header(aggregation'{"key":{"country":"'Texas'","currency":"'USD'"},"value":["country","currency","stock","price"]}')`,
              type: "test.AnalyticsService.Header",
            },
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
      "/v2/analytics/Header?$select=currency,stock&$top=4&$orderby=stock asc"
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
              )}/v2/analytics/Header(aggregation'{"key":{"currency":"'USD'"},"value":["currency","stock"]}')`,
              type: "test.AnalyticsService.Header",
            },
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
        stock: 42,
      },
    });
  });
});
