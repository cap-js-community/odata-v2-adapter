const supertest = require('supertest');

const util = require('../../util');
const Headers = require('./Header');

module.exports = async ({app}) => {
    const request = supertest(app);
    await Promise.all(
        Headers.map(async header => {
            await util.callWrite(request, '/main/Header', header);
        })
    );
};
