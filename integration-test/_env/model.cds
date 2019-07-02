namespace test;

using { managed, cuid } from '@sap/cds/common';

entity Header: cuid, managed {
    name: String;
    description: String;
    country: String;
    currency: String;
    stock: Integer;
    price: Decimal(12, 2);
}

service MainService {

    entity Header as projection on test.Header;

    define entity HeaderParameters (
        aStock: Integer,
        aCurrency: String
    ) as SELECT * from test.Header where stock=:aStock and currency=:aCurrency;

}
