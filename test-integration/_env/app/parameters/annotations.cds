using AgreementService from '../../srv/agreement';

annotate AgreementService.AgreementItemPricingForKeyDate with @(
    UI: {
      Identification: [
        { Value: ID }
      ],
      SelectionFields: [
        keyDate,
        ID
      ],
      LineItem: [
        { Value: ID },
        { Value: Item },
        { Value: validFrom },
        { Value: validTo },
      ],
      HeaderInfo: {
          TypeName: 'Agreement Item Price',
          TypeNamePlural: 'Agreement Item Price',
          Title: { Value: ID },
          Description: { Value: Item }
      },
      Facets: [
          { $Type: 'UI.ReferenceFacet', Label: 'General', Target: '@UI.FieldGroup#General' }
      ],
      FieldGroup#General: {
          Data: [
              { $Type: 'UI.DataField', Value: ID, Label: 'ID' },
              { $Type: 'UI.DataField', Value: Item, Label: 'Item ID' },
              { $Type: 'UI.DataField', Value: validFrom, Label: 'Valid From' },
              { $Type: 'UI.DataField', Value: validTo, Label: 'Valid To' },
          ]
      }
    }
);