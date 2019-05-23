const supertest = require('supertest');

const util = require('../../util');
const Headers = require('./Header');

module.exports = async ({app}) => {
    const request = supertest(app);
    const responses = await Promise.all(
        Headers.map(async header => {
            return await util.callWrite(request, '/main/Header', header, false, {
                "content-type": "application/json;IEEE754Compatible=true"
            });
        })
    );
    console.log("Test Instances: " + responses.length);
};
