namespace test;

using test from './main';
using sap.common from '@sap/cds/common';

service AnalyticsService {

    @readonly
    @Aggregation.ApplySupported.PropertyRestrictions
    @cds.redirection.target
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

    @cds.redirection.target
    entity HeaderItem as projection on test.HeaderItem;

    @Aggregation.ApplySupported.PropertyRestrictions
    entity HeaderItemCount as projection on test.HeaderItem {
        ID,
        @title: '{i18n>Name}'
        name,
        @title: '{i18n>Description}'
        description,
        @Analytics.Dimension
        @title: '{i18n>StartAt}'
        startAt,
        @title: '{i18n>EndAt}'
        endAt,
        @Analytics.Measure
        @Aggregation.default : #COUNT_DISTINCT
        header.ID as header,
        @Analytics.Measure
        @Aggregation.default : #COUNT_DISTINCT
        @Aggregation.referenceElement: ['header']
        1 as header2: Integer,
        @Analytics.Measure
        @Aggregation.default : #COUNT
        header.ID as header_count
    };

    @readonly
    @cov2ap.analytics: false
    @Aggregation.ApplySupported.PropertyRestrictions
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
        price,
        description
    } actions {
        action order(number: Integer) returns Book;
    };

    @cov2ap.analytics.skipForKey
    entity HeaderSkipKey as projection on test.Header {
        key ID,
        description,
        @Analytics.Dimension
        key country,
        @Analytics.Dimension
        key currency,
        @Analytics.Measure
        stock,
        @Analytics.Measure
        @Aggregation.default : #AVG
        price,
    };
}
