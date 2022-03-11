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
    Lines: Composition of many HeaderLine on Lines.item = $self;
}

entity HeaderLine: cuid {
    name: String;
    value: Double;
    item: Association to HeaderItem;
}

entity HeaderStream: cuid {
    @Core.MediaType: mediaType
    @Core.ContentDisposition.Filename: filename
    data: LargeBinary;
    @Core.IsMediaType
    mediaType: String;
    filename: String;
    custom: String;
    totalAmount: Integer;
    isBlocked: Boolean;
}

entity HeaderStreamAttachment: cuid {
    @Core.MediaType: mediaType
    @Core.ContentDisposition.Filename: filename
    @Core.ContentDisposition.Type: 'attachment'
    data: LargeBinary;
    @Core.IsMediaType
    mediaType: String;
    filename: String;
}

entity HeaderStreamDecode: cuid {
    @Core.MediaType: mediaType
    @Core.ContentDisposition.Filename: filename
    data: LargeBinary;
    @Core.IsMediaType
    mediaType: String;
    @cov2ap.headerDecode: ['base64', 'uriComponent']
    filename: String;
    custom: String;
    totalAmount: Integer;
    isBlocked: Boolean;
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

entity HeaderBinary: cuid {
    // @Core.MediaType
    data: LargeBinary;
    name: String;
}

entity HeaderAssocKey {
    key header: Association to Header;
    num: Double;
}

entity HeaderTemporal: cuid { // temporal
  key validFrom: Timestamp @cds.valid.from;
  validTo: Timestamp @cds.valid.to;
  name: String;
  value: String;
}

@cov2ap.deltaResponse: 'timestamp'
entity HeaderDelta: cuid, managed {
    name: String;
    description: String;
    Items: Composition of many HeaderItemDelta on Items.header = $self;
}

@cov2ap.deltaResponse: 'timestamp'
entity HeaderItemDelta: cuid {
    name: String;
    description: String;
    header: Association to HeaderDelta;
}

entity HeaderLargeString {
    key name: LargeString;
    key country: LargeString;
    currency: LargeString;
    stock: Integer;
    Items: Composition of many HeaderItemLargeString on Items.header = $self;
}

entity HeaderItemLargeString {
    key name: LargeString;
    key position: LargeString;
    value: Integer;
    header: Association to HeaderLargeString;
}

entity Favorite {
    key name: String;
    value: String;
}

entity StringUUID {
    key ID: UUID @odata.Type : 'Edm.String';
    name: String;
}

service MainService {

    type Result {
        name: String;
        code: String;
        age: Integer;
    }

    entity Header as projection on test.Header actions {
        action boundAction(num: Integer, text: String) returns Result;
        action boundMassAction(ids: array of String) returns array of Result;
        action boundActionInline(num: Integer, text: String) returns {
            name: String;
            code: String;
            age: Integer;
        };
        action boundMassActionInline(ids: array of String) returns array of {
            name: String;
            code: String;
            age: Integer;
        };
        action boundActionNoReturn(num: Integer, text: String);
        action boundActionPrimitive(num: Integer) returns Integer;
        action boundActionPrimitiveString(text: String) returns String;
        action boundActionPrimitiveLargeString(text: LargeString) returns LargeString;
        action boundMassActionPrimitive(text1: String, text2: String) returns array of String;
        action boundActionEntity(num: Integer, text: String) returns Header;
        action boundMassActionEntity(ids: array of String) returns array of Header;

        function boundFunction(num: Integer, text: String) returns Result;
        function boundMassFunction(ids: array of String) returns array of Result;
        function boundFunctionInline(num: Integer, text: String) returns {
             name: String;
             code: String;
             age: Integer;
        };
        function boundMassFunctionInline(num: Integer, text: String) returns array of {
             name: String;
             code: String;
             age: Integer;
        };
        function boundFunctionPrimitive(num: Integer) returns Integer;
        function boundFunctionPrimitiveString(text: String) returns String;
        function boundFunctionPrimitiveLargeString(text: LargeString) returns LargeString;
        function boundMassFunctionPrimitive(text1: String, text2: String) returns array of String;
        function boundFunctionEntity(num: Integer, text: String) returns Header;
        function boundMassFunctionEntity(ids: array of String) returns array of Header;
        function boundErrorFunction() returns Result;
        function boundWarningFunction() returns Result;
    };
    entity HeaderItem as projection on test.HeaderItem;
    entity HeaderLine as projection on test.HeaderLine;
    entity HeaderStream as projection on test.HeaderStream;
    entity HeaderStreamAttachment as projection on test.HeaderStreamAttachment;
    entity HeaderStreamDecode as projection on test.HeaderStreamDecode;
    entity HeaderUrlStream as projection on test.HeaderUrlStream;
    entity HeaderBinary as projection on test.HeaderBinary;
    entity HeaderAssocKey as projection on test.HeaderAssocKey;
    entity HeaderTemporal as projection on test.HeaderTemporal;
    entity HeaderDelta as projection on test.HeaderDelta;
    entity HeaderItemDelta as projection on test.HeaderItemDelta;
    entity HeaderLargeString as projection on test.HeaderLargeString;
    entity HeaderItemLargeString as projection on test.HeaderItemLargeString;

    entity Favorite as projection on test.Favorite;
    entity StringUUID as projection on test.StringUUID;

    action unboundAction(num: Integer, text: String) returns Result;
    action unboundMassAction(ids: array of String) returns array of Result;
    action unboundActionInline(num: Integer, text: String) returns {
        name: String;
        code: String;
        age: Integer;
    };
    action unboundMassActionInline(ids: array of String) returns array of {
        name: String;
        code: String;
        age: Integer;
    };
    action unboundActionNoReturn(num: Integer, text: String);
    action unboundActionPrimitive(num: Integer) returns Integer;
    action unboundActionPrimitiveString(text: String) returns String;
    action unboundActionPrimitiveLargeString(text: LargeString) returns LargeString;
    action unboundMassActionPrimitive(text1: String, text2: String) returns array of String;
    action unboundActionEntity(num: Integer, text: String) returns Header;
    action unboundMassActionEntity(ids: array of String) returns array of Header;
    action unboundActionMaxLength(text: String(10)) returns String(10);

    function unboundFunction(num: Integer, text: String) returns Result;
    function unboundMassFunction(ids: array of String) returns array of Result;
    function unboundFunctionInline(num: Integer, text: String) returns {
         name: String;
         code: String;
         age: Integer;
    };
    function unboundMassFunctionInline(ids: array of String) returns array of {
        name: String;
        code: String;
        age: Integer;
    };
    function unboundFunctionPrimitive(num: Integer) returns Integer;
    function unboundFunctionPrimitiveString(text: String) returns String;
    function unboundFunctionPrimitiveLargeString(text: LargeString) returns LargeString;
    function unboundMassFunctionPrimitive(text1: String, text2: String) returns array of String;
    function unboundFunctionEntity(num: Integer, text: String) returns Header;
    function unboundMassFunctionEntity(ids: array of String) returns array of Header;

    function unboundDecimalFunction() returns Decimal(19,4);
    function unboundDecimalsFunction() returns array of Decimal(19,4);
    function unboundErrorFunction() returns Result;
    function unboundWarningFunction() returns Result;
    function unboundNavigationFunction(num: Integer, text: String) returns Header;
    function unboundNavigationsFunction(num: Integer, text: String) returns array of Header;

    function calcDecimal(value: Decimal, percentage: Decimal) returns Decimal;
}