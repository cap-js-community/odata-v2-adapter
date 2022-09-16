namespace test;

using { managed, cuid } from '@sap/cds/common';
using { test as testModel } from '../db/model';

service MainService {

    entity Header as projection on test.Header;

    define entity HeaderParameters (
        STOCK: Integer,
        CURRENCY: String not null // mandatory parameter
    ) as SELECT
        // Parameters need to be included in view definition as keys, to make UI List Report working with parameters
        key :STOCK as STOCK_PARAM,
        key :CURRENCY as CURRENCY_PARAM,
        // Primary key need to be included in view definition as keys, to make record still identifiable
        key ID,
        *
    from test.Header where stock=:STOCK and currency=:CURRENCY;

    define entity HeaderSet (
        STOCK: Integer,
        CURRENCY: String not null // mandatory parameter
    ) as SELECT
        // Parameters need to be included in view definition as keys, to make UI List Report working with parameters
        key :STOCK as STOCK_PARAM,
        key :CURRENCY as CURRENCY_PARAM,
        // Primary key need to be included in view definition as keys, to make record still identifiable
        key ID,
        *
    from test.Header where stock=:STOCK and currency=:CURRENCY;
}