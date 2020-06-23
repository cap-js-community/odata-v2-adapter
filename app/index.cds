using test.MainService from '../test/_env/model.cds';

annotate MainService.Header with @(
	UI: {
         Identification: [
        	{ Value: name }
         ],
         SelectionFields: [ name, currency, country ],
         LineItem: [
            { $Type: 'UI.DataField', Value: name, Label: 'Name' },
            { $Type: 'UI.DataField', Value: price, Label: 'Price' },
            { $Type: 'UI.DataField', Value: currency, Label: 'Currency' },
            { $Type: 'UI.DataField', Value: stock, Label: 'Stock' },
            { $Type: 'UI.DataField', Value: country, Label: 'Country' }
        ],
        HeaderInfo: {
            $Type: 'UI.HeaderInfoType',
            TypeName: 'Header',
            TypeNamePlural: 'Headers',
            Title: { Value: name },
            Description: { Value: description }
        },
        Facets: [
        	{$Type: 'UI.ReferenceFacet', Label: 'General', Target: '@UI.FieldGroup#General'},
        	{$Type: 'UI.ReferenceFacet', Label: 'Items', Target: 'Items/@UI.LineItem'}
        ],
        FieldGroup#General: {
        	Data: [
        		{ $Type: 'UI.DataField', Value: name, Label: 'Name' },
        		{ $Type: 'UI.DataField', Value: price, Label: 'Price' },
        		{ $Type: 'UI.DataField', Value: currency, Label: 'Currency' },
        		{ $Type: 'UI.DataField', Value: stock, Label: 'Stock' },
        		{ $Type: 'UI.DataField', Value: country, Label: 'Country' }
        	]
        }
	}
);

annotate MainService.HeaderItem with @(
	UI: {
        Identification: [
        	{ Value: name }
        ],
        SelectionFields: [ name, startAt, endAt  ],
        LineItem: [
        	{ $Type: 'UI.DataField', Value: name, Label: 'Name'},
        	{ $Type: 'UI.DataField', Value: description, Label: 'Description'},
        	{ $Type: 'UI.DataField', Value: startAt, Label: 'Start At'},
        	{ $Type: 'UI.DataField', Value: endAt, Label: 'End At'}
		],
        HeaderInfo: {
        	$Type: 'UI.HeaderInfoType',
        	TypeName: 'Item',
        	TypeNamePlural: 'Items',
        	Title: { Value: name },
            Description: { Value: description }
        },
        Facets: [
        	{$Type: 'UI.ReferenceFacet', Label: 'General', Target: '@UI.FieldGroup#General'},
        ],
		FieldGroup#General: {
        	Data: [
        		{ $Type: 'UI.DataField', Value: name, Label: 'Name'},
        		{ $Type: 'UI.DataField', Value: description, Label: 'Description'},
        		{ $Type: 'UI.DataField', Value: startAt, Label: 'Start At'},
        		{ $Type: 'UI.DataField', Value: endAt, Label: 'End At'}
        	]
        }
	}
);
