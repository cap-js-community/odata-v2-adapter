'use strict';

const fs = require('fs');
const supertest = require('supertest');

const env = require('./_env');
const util = require('./_env/util');

let context;
let request;

describe('batch-request', () => {
    beforeAll(async () => {
        context = await env('model');
        request = supertest(context.app);
    });

    afterAll(() => {
        env.end(context);
    });

    it('GET request', async () => {
        let payload = fs.readFileSync('./test/_env/data/batch/Batch-GET.txt', 'utf8');
        payload = payload.replace(/\r\n/g, '\n');
        const response = await util.callMultipart(request, '/v2/main/$batch', payload);
        expect(response.statusCode).toEqual(200);
        expect(response.body.includes('HTTP/1.1 200 OK')).toEqual(true);
        expect(
            response.body.includes(
                JSON.stringify({
                    d: {
                        results: []
                    }
                })
            )
        ).toEqual(true);
    });

    it('POST request', async () => {
        let payload = fs.readFileSync('./test/_env/data/batch/Batch-POST.txt', 'utf8');
        payload = payload.replace(/\r\n/g, '\n');
        let response = await util.callMultipart(request, '/v2/main/$batch', payload);
        expect(response.statusCode).toEqual(200);
        expect((response.body.match(/HTTP\/1.1 201 Created/g) || []).length).toEqual(2);
        const id = (response.body.match(/"ID":"(.*?)"/) || []).pop();
        expect(id).toBeDefined();
        expect(response.body.includes('"Items":{"results":[')).toEqual(true);
        expect(response.body.includes('"FirstItem":null')).toEqual(true);
        response = await util.callRead(request, `/v2/main/Header(guid'${id}')`);
        expect(response.body.d).toMatchObject({
            __metadata: {
                type: 'test.MainService.Header',
                uri: `http://${response.request.host}/v2/main/Header(guid'${id}')`
            },
            ID: id,
            createdBy: 'anonymous',
            description: null,
            modifiedAt: null,
            modifiedBy: null,
            name: 'Test',
            Items: {
                __deferred: {
                    uri: `http://${response.request.host}/v2/main/Header(guid'${id}')/Items`
                }
            }
        });
    });

    it('PUT request', async () => {
        let response = await util.callWrite(request, '/v2/main/Header', {
            name: 'Test'
        });
        expect(response.statusCode).toEqual(201);
        const id = response.body.d.ID;
        expect(id).toBeDefined();
        let payload = fs.readFileSync('./test/_env/data/batch/Batch-PUT.txt', 'utf8');
        payload = payload.replace(/\r\n/g, '\n');
        payload = payload.replace(/{{ID}}/g, id);
        response = await util.callMultipart(request, '/v2/main/$batch', payload);
        expect(response.statusCode).toEqual(200);
        expect((response.body.match(/HTTP\/1.1 200 OK/g) || []).length).toEqual(1);
        response = await util.callRead(request, `/v2/main/Header(guid'${id}')`);
        expect(response.body.d.name).toEqual('Test Update');
    });

    it('PATCH request', async () => {
        let response = await util.callWrite(request, '/v2/main/Header', {
            name: 'Test',
            Items: [
                {
                    name: 'TestItem'
                }
            ]
        });
        expect(response.statusCode).toEqual(201);
        const id = response.body.d.ID;
        expect(id).toBeDefined();
        const itemId = response.body.d.Items.results[0].ID;
        expect(itemId).toBeDefined();
        let payload = fs.readFileSync('./test/_env/data/batch/Batch-PATCH.txt', 'utf8');
        payload = payload.replace(/\r\n/g, '\n');
        payload = payload.replace(/{{ID}}/g, id);
        payload = payload.replace(/{{ItemID}}/g, itemId);
        response = await util.callMultipart(request, '/v2/main/$batch', payload);
        expect(response.statusCode).toEqual(200);
        expect((response.body.match(/HTTP\/1.1 200 OK/g) || []).length).toEqual(2);
        response = await util.callRead(request, `/v2/main/Header(guid'${id}')?$expand=Items`);
        expect(response.body.d.name).toEqual('Test Update Changeset');
        expect(response.body.d.Items.results[0].name).toEqual('Test Item Update Changeset');
    });

    it('DELETE request', async () => {
        let response = await util.callWrite(request, '/v2/main/Header', {
            name: 'Test'
        });
        expect(response.statusCode).toEqual(201);
        const id = response.body.d.ID;
        expect(id).toBeDefined();
        let payload = fs.readFileSync('./test/_env/data/batch/Batch-DELETE.txt', 'utf8');
        payload = payload.replace(/\r\n/g, '\n');
        payload = payload.replace(/{{ID}}/g, id);
        response = await util.callMultipart(request, '/v2/main/$batch', payload);
        expect(response.statusCode).toEqual(200);
        expect((response.body.match(/HTTP\/1.1 204 No Content/g) || []).length).toEqual(1);
        response = await util.callRead(request, `/v2/main/Header(guid'${id}')`);
        expect(response.statusCode).toEqual(404);
    });

    it('POST action request', async () => {
        let payload = fs.readFileSync('./test/_env/data/batch/Batch-Action.txt', 'utf8');
        payload = payload.replace(/\r\n/g, '\n');
        let response = await util.callMultipart(request, '/v2/main/$batch', payload);
        expect(response.statusCode).toEqual(200);
        expect(
            response.body.includes(
                JSON.stringify({
                    d: {
                        name: 'abc1',
                        code: 'TEST',
                        age: 1
                    }
                })
            )
        ).toEqual(true);
        expect(
            response.body.includes(
                JSON.stringify({
                    results: [
                        {
                            name: 'abc2',
                            code: 'TEST',
                            age: 2
                        }
                    ]
                })
            )
        ).toEqual(true);
    });
});
