using test.AnalyticsService from '../../srv/analytics';

annotate AnalyticsService.Header with @(

	UI: {
        PresentationVariant#Price: {
            SortOrder: [{
                Property: price,
                Descending: true
            }],
            Visualizations: [
                '@UI.Chart#Price'
            ]
        },

        Chart#Price: {
            Qualifier: Price,
            ChartType: #Bar,
            Measures:  ['price'],
            MeasureAttributes: [{
                Measure: 'Price',
                Role: #Axis1
            }],
            Dimensions:  ['currency'],
            DimensionAttributes: [{
                Dimension: 'Currency',
                Role: #Category
            }]
        },

        PresentationVariant#Stock: {
            SortOrder: [{
                Property: stock,
                Descending: true
            }],
            Visualizations: [
                '@UI.Chart#Stock'
            ]
        },

        Chart#Stock: {
            Qualifier: Stock,
            ChartType: #Donut,
            Measures:  ['stock'],
            MeasureAttributes: [{
                Measure: 'Stock',
                Role: #Axis1
            }],
            Dimensions:  ['country'],
            DimensionAttributes: [{
                Dimension: 'Country',
                Role: #Category
            }]
        }
	}
);

annotate AnalyticsService.Header with {
    @Common: {
        ValueList#Price: {
            CollectionPath: 'Header',
            Label: '{i18n>Country}',
            SearchSupported: true,
            PresentationVariantQualifier: 'Price',
            Parameters: [
                {
                    $Type: 'Common.ValueListParameterInOut',
                    LocalDataProperty: 'currency',
                    ValueListProperty: 'currency'
                }
            ]
        }
    }
    currency;

    @Common: {
        ValueList#Stock: {
            CollectionPath: 'Header',
            Label: '{i18n>Currency}',
            SearchSupported: true,
            PresentationVariantQualifier: 'Stock',
            Parameters: [
                {
                    $Type: 'Common.ValueListParameterInOut',
                    LocalDataProperty: 'country',
                    ValueListProperty: 'country'
                }
            ]
        }
    }
    country;
};
