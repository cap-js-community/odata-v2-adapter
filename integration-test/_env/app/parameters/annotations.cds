using AgreementService from '../../srv/agreementService.cds';

annotate AgreementService.AgreementItemPricing with @(
    UI: {
      SelectionFields: [
        ID,
        validFrom,
        validTo,
      ],
      LineItem: [
        { Value: ID },
        { Value: item.ID },
        { Value: validFrom },
        { Value: validTo },
      ]
    }
);