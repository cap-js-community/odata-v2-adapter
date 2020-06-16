namespace test;

using { managed, cuid } from '@sap/cds/common';

entity Header: cuid, managed {
    name: String;
    description: String;
    country: String;
    currency: String;
    stock: Integer;
    price: Decimal(12, 2);

    Items: Composition of many HeaderItem on Items.header = $self;
    FirstItem: Association to HeaderItem;
}

entity HeaderItem: cuid {
    name: String;
    description: String;
    startAt: Timestamp;
    endAt: Timestamp;
    header: Association to Header;
    NextItem: Association to HeaderItem;
    assoc: Association to HeaderAssocKey;
}

entity HeaderStream: cuid {
    @Core.MediaType: mediaType
    data: LargeBinary;
    @Core.IsMediaType
    mediaType: String;
    @Core.ContentDisposition.Filename
    filename: String;
}

entity HeaderUrlStream: cuid {
    @Core.MediaType: mediaType
    @Core.IsURL: true
    link: String;
    @Core.IsMediaType
    mediaType: String;
    @Core.ContentDisposition.Filename
    filename: String;
}

entity HeaderAssocKey {
    key header: Association to Header;
    num: Double;
}

entity Favorite {
    key name: String;
    value: String;
}

service MainService {

    type Result {
        name: String;
        code: String;
        age: Integer;
    }

    entity Header as projection on test.Header actions {
        action boundAction(num: Integer, text: String) returns Result;
        function boundFunction(num: Integer, text: String) returns array of Result;
    };
    entity HeaderItem as projection on test.HeaderItem;
    entity HeaderStream as projection on test.HeaderStream;
    entity HeaderUrlStream as projection on test.HeaderUrlStream;
    entity HeaderAssocKey as projection on test.HeaderAssocKey;

    entity Favorite as projection on test.Favorite;

    action unboundAction(num: Integer, text: String) returns array of Result;
    function unboundFunction(num: Integer, text: String) returns Result;
    function unboundDecimalFunction() returns Decimal(19,4);
    function unboundDecimalsFunction() returns array of Decimal(19,4);
    function unboundErrorFunction() returns Result;
    function unboundWarningFunction() returns Result;
    function unboundNavigationFunction(num: Integer, text: String) returns Header;
    function unboundNavigationsFunction(num: Integer, text: String) returns array of Header;
}