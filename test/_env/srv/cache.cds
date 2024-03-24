namespace test;

using { managed } from '@sap/cds/common';
using test from './main';

service CacheService {

    entity Header as projection on test.Header;

    entity HeaderMore as projection on Header {
        *,
        virtual null as dueAt: Date
    }
}