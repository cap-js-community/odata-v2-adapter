namespace test;

using test from './model';
using sap.common from '@sap/cds/common';

service AnalyticsService {

    @readonly
    @Aggregation.ApplySupported.PropertyRestrictions: true
    @cds.redirection.target: true
    entity Header as projection on test.Header {
        ID,
        @title: '{i18n>Description}'
        description,
        @Analytics.Dimension
        @title: '{i18n>Country}'
        country,
        @Analytics.Dimension
        @title: '{i18n>Currency}'
        currency,
        @Analytics.Measure
        @title: '{i18n>Stock}'
        stock,
        @Analytics.Measure
        @Aggregation.default : #AVG
        @title: '{i18n>Price}'
        price,
        Items
    } excluding {
        createdBy,
        createdAt,
        modifiedBy,
        modifiedAt
    };

    @readonly
    @cov2ap.analytics: false
    @Aggregation.ApplySupported.PropertyRestrictions: true
    entity HeaderDisabledAnalytics as projection on test.Header {
        ID,
        description,
        @Analytics.Dimension
        country,
        currency,
        @Analytics.Measure
        stock,
        @Analytics.Measure
        @Aggregation.default : #AVG
        price,
        Items
    } excluding {
        createdBy,
        createdAt,
        modifiedBy,
        modifiedAt
    };

    entity HeaderItem as projection on test.HeaderItem;

    entity Country as projection on common.Countries;
    entity Currency as projection on common.Currencies;
}
