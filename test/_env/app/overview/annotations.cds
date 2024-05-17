using test.AnalyticsService from '../../srv/analytics';

annotate AnalyticsService.Header with @(
    UI: {
        SelectionFields: [ description, country, currency ],
        LineItem: [
            {$Type: 'UI.DataField', Label: '{i18n>Description}', Value: description},
            {$Type: 'UI.DataField', Label: '{i18n>Country}', Value: country},
            {$Type: 'UI.DataField', Label: '{i18n>Currency}', Value: currency},
            {$Type: 'UI.DataField', Label: '{i18n>Stock}', Value: stock},
            {$Type: 'UI.DataField', Label: '{i18n>Price}', Value: price},
        ],
        DataPoint: {
            Title: 'Price',
            Value: price
        },
        Chart: {
            ChartType: #Donut,
            Measures: ['price'],
            MeasureAttributes: [{
                Measure: 'price',
                Role: #Axis1
            }],
            Dimensions: ['currency'],
            DimensionAttributes: [{
                Dimension: 'currency',
                Role: #Category
            }]
        }
    }
);

annotate AnalyticsService.Header with {
    @Common: {
        ValueList: {
            CollectionPath: 'Country',
            Label: '{i18n>Country}',
            SearchSupported: true,
            Parameters: [
                {
                    $Type: 'Common.ValueListParameterInOut',
                    LocalDataProperty: 'country',
                    ValueListProperty: 'code'
                },
                {
                    $Type: 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'descr'
                }
            ]
        }
    }
    country;

    @Common: {
        ValueListWithFixedValues,
        ValueList: {
            CollectionPath: 'Currency',
            Label: '{i18n>Country}',
            SearchSupported: true,
            Parameters: [
                {
                    $Type: 'Common.ValueListParameterInOut',
                    LocalDataProperty: 'currency',
                    ValueListProperty: 'code'
                },
                {
                    $Type: 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'descr'
                }
            ]
        }
    }
    currency;
};