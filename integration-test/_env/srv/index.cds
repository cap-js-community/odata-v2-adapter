namespace test;

using { test as testModel } from '../db/model';
using { managed, cuid } from '@sap/cds/common';

service MainService {

    entity Header as projection on test.Header;

    define entity HeaderParameters (
        STOCK: Integer,
        CURRENCY: String not null // mandatory parameter
    ) as SELECT
        // Hint: Parameters need to be included in view definition as keys, to UI List Report with parameters working
        key :STOCK as STOCK,
        key :CURRENCY as CURRENCY,
        *
    from test.Header where stock=:STOCK and currency=:CURRENCY;

}