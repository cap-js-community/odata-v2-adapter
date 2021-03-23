namespace test;

using test from './model';

service AnalyticsService {

    @readonly
    @Aggregation.ApplySupported.PropertyRestrictions: true
    @cds.redirection.target: true
    entity Header as projection on test.Header {
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
}
