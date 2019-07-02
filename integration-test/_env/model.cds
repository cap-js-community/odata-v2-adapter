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
      stock: Integer,
      currency: String
    ) as SELECT * from Header where stock=:stock and currency=:currency;
}
