const supertest = require("supertest");
const cds = require("@sap/cds");

const util = require("./_env/util/request");

cds.test(__dirname + "/_env");

cds.env.cov2ap.ieee754Compatible = false;

describe("decimal", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app.server);
  });

  it("GET decimal in entity", async () => {
    let response = await util.callRead(request, "/odata/v2/main/Book(author='Catweazle',genre_ID=1)");
    expect(response.body).toBeDefined();
    expect(response.body.d.author).toEqual("Catweazle");
    expect(response.body.d.genre_ID).toEqual(1);
    expect(response.body.d.stock).toEqual(11);
    expect(response.body.d.price).toEqual(12.3456789);
  });

  it("GET unbound decimal function", async () => {
    let response = await util.callRead(request, "/odata/v2/main/unboundDecimalFunction");
    expect(response.body).toMatchObject({
      d: {
        unboundDecimalFunction: 12345.6789,
      },
    });
    response = await util.callRead(request, "/odata/v2/main/unboundDecimalsFunction");
    expect(response.body).toMatchObject({
      d: {
        results: [12345.6789, 12345.6789],
      },
    });
    response = await util.callRead(request, "/odata/v2/main/unboundDecimalResultFunction");
    expect(response.body).toMatchObject({
      d: {
        unboundDecimalResultFunction: {
          name: "Test",
          decimal: 12345.6789,
          array: [
            {
              name: "Test",
              decimal: 12345.6789,
            },
          ],
        },
      },
    });
  });
});
