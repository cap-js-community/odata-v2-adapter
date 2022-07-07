using { agreement } from '../db/agreement';

service AgreementService {

    @readonly
    entity Agreement as projection on agreement.Agreement;
    @readonly
    entity AgreementItem as projection on agreement.AgreementItem;
    @readonly
    entity AgreementItemPricing as projection on agreement.AgreementItemPricing;
    @readonly
    entity AgreementStatus as projection on agreement.Status;

    @readonly
    @Aggregation.ApplySupported: {
        Transformations : [
          'aggregate',
          'groupby',
          'filter'
        ],
        Rollup: 'None'
    }
    @Capabilities.FilterRestrictions: {
        NonFilterableProperties: [keyDate]
    }
    @Capabilities.NavigationRestrictions: {
        RestrictedProperties: [
            {NavigationProperty: Parameters, FilterRestrictions: {Filterable : false}}
        ]
    }
    @Capabilities.SortRestrictions: {
        NonSortableProperties : [keyDate]
    }
    entity AgreementItemPricingForKeyDate(keyDate: Date not null) as
    select
      key : keyDate as keyDate,
      key AgreementItemPricing.ID,
          AgreementItemPricing.item.ID as Item,
          @title: '{i18n>validFrom}'
          AgreementItemPricing.validFrom,
          @title: '{i18n>validTo}'
          AgreementItemPricing.validTo
    from agreement.AgreementItemPricing
    where
          AgreementItemPricing.validFrom <= : keyDate
      and AgreementItemPricing.validTo   >= : keyDate;
}

/*
annotate AgreementService.AgreementItemPricingForKeyDate @(
    UI.SelectionVariant #params : {
      SelectOptions: [],
      Parameters: [{
        $Type: 'UI.Parameter',
        PropertyName: keyDate,
        PropertyValue: 'TODAY'
      }]
    }
);
*/

annotate AgreementService.AgreementItemPricingForKeyDate with @(
    UI : {
      SelectionFields: [
        keyDate,
        ID
      ],
      LineItem: [
        {Value : ID, },
        {Value : Item, },
        {Value : validFromString, },
        {Value : validToString, },
        {Value : validFrom, },
        {Value : validTo, }
      ]
    }
);