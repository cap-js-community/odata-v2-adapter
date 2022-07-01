using {
  cuid,
  managed,
  sap.common.CodeList as CodeList
} from '@sap/cds/common';

namespace agreement;

entity Status: CodeList {
    key code: String(40);
};

entity Agreement : cuid, managed {
    description : String(100);
    items: Composition of many AgreementItem on items.agreement = $self;
};

entity AgreementItem : cuid, managed {
    agreement: Association to one Agreement not null;
    pricings: Composition of many AgreementItemPricing on pricings.item = $self;
};

entity AgreementItemPricing : cuid {
    item      : Association to one AgreementItem not null;
    validFrom : Date @title : '{i18n>validFrom}';
    validTo   : Date @title : '{i18n>validTo}';
    status    : Association to one Status not null;
};