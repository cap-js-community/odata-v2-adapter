namespace test;

using { managed, cuid } from '@sap/cds/common';
using { test as testModel } from '../db/model';

service MainService {

    entity Header as projection on test.Header;

    define entity HeaderParameters (
        STOCK: Integer,
        CURRENCY: String not null // mandatory parameter
    ) as SELECT
        // Hint: Parameters need to be included in view definition as keys, to UI List Report with parameters working
        key :STOCK as STOCK_PARAM,
        key :CURRENCY as CURRENCY_PARAM,
        *
    from test.Header where stock=:STOCK and currency=:CURRENCY;
}