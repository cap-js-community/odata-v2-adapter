'use strict';

const fs = require('fs');
const supertest = require('supertest');

const env = require('./_env');
const util = require('./_env/util');
const init = require('./_env/data/test/init');

let context;
let request;

describe('batch-request', () => {
    beforeAll(async () => {
        context = await env('analyticsmodel', 0, init);
        request = supertest(context.app);
    });

    afterAll(() => {
        env.end(context);
    });

    it('GET request with grouping and aggregation', async () => {
        const response = await util.callRead(request, '/v2/analytics/Header?$select=currency,stock');
        expect(response.body).toBeDefined();
        expect(response.body).toEqual({
            d: {
                results: [{
                    currency: 'EUR',
                    stock: 25
                }, {
                    currency: 'USD',
                    stock: 17
                }]
            }
        });
    });

});
