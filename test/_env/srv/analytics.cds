namespace test;

using test from './main';
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
    };

    entity HeaderItem as projection on test.HeaderItem;

    entity Country as projection on common.Countries;
    entity Currency as projection on common.Currencies;

    @Aggregation.ApplySupported.PropertyRestrictions
    entity Book as projection on test.Book {
        @Analytics.Dimension
        key author,
        @Analytics.Dimension
        key genre_ID,
        @Analytics.Measure
        @Aggregation.default: #SUM
        stock,
        @Analytics.Measure
        @Aggregation.default: #SUM
        price
    } actions {
        action order(number: Integer) returns Book;
    };
}
