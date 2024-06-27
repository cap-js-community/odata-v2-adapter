using test.MainService from '../../srv/main';

annotate MainService.Header with @(
    UI: {
        Identification: [
            { Value: name },
        ],
        SelectionFields: [ name, currency, country ],
        LineItem: [
            { $Type: 'UI.DataField', Value: name, Label: 'Name' },
            { $Type: 'UI.DataField', Value: price, Label: 'Price' },
            { $Type: 'UI.DataField', Value: currency, Label: 'Currency' },
            { $Type: 'UI.DataField', Value: stock, Label: 'Stock' },
            { $Type: 'UI.DataField', Value: country, Label: 'Country' },
            { $Type: 'UI.DataField', Value: date, Label: 'Date' },
            { $Type: 'UI.DataField', Value: dateTime, Label: 'Date Time' },
            { $Type: 'UI.DataField', Value: time, Label: 'Time' },
            { $Type: 'UI.DataField', Value: timestamp, Label: 'Timestamp' },
        ],
        HeaderInfo: {
            $Type: 'UI.HeaderInfoType',
            TypeName: 'Header',
            TypeNamePlural: 'Headers',
            Title: { Value: name },
            Description: { Value: description }
        },
        Facets: [
            { $Type: 'UI.ReferenceFacet', Label: 'General', Target: '@UI.FieldGroup#General' },
        ],
        FieldGroup#General: {
            Data: [
                { $Type: 'UI.DataField', Value: name, Label: 'Name' },
                { $Type: 'UI.DataField', Value: price, Label: 'Price' },
                { $Type: 'UI.DataField', Value: currency, Label: 'Currency' },
                { $Type: 'UI.DataField', Value: stock, Label: 'Stock' },
                { $Type: 'UI.DataField', Value: country, Label: 'Country' },
                { $Type: 'UI.DataField', Value: date, Label: 'Date' },
                { $Type: 'UI.DataField', Value: dateTime, Label: 'Date Time' },
                { $Type: 'UI.DataField', Value: time, Label: 'Time' },
                { $Type: 'UI.DataField', Value: timestamp, Label: 'Timestamp' },
            ]
        }
    }
);