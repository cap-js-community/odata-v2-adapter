namespace test;

using { test as testModel } from '../db/model';
using { managed, cuid } from '@sap/cds/common';

service MainService {

    entity Header as projection on test.Header;

    define entity HeaderParameters (
        STOCK: Integer,
        CURRENCY: String
    ) as SELECT * from test.Header where stock=:STOCK and currency=:CURRENCY;

}