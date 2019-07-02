'use strict';

const supertest = require('supertest');

const env = require('./_env');
const util = require('./_env/util');

let context;
let request;

describe('request', () => {
    beforeAll(async () => {
        context = await env('model');
        request = supertest(context.app);
    });

    afterAll(() => {
        env.end(context);
    });

    it('GET with parameters', async () => {
        let response = await util.callRead(request, `/v2/main/HeaderParameters(aStock=10,aCurrency='USD')/Set`);
        expect(response.body).toBeDefined();
        expect(response.body.d.results).toHaveLength(0);
    });
});
