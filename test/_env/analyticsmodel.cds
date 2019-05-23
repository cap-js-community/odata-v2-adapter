namespace test;

using test from './model';

service AnalyticsService {

    @Aggregation.ApplySupported.PropertyRestrictions: true
    @readonly entity Header as projection on test.Header {
        ID,
        description,
        currency,
        @Analytics.Measure: true
        @Aggregation.default: #SUM
        stock
    } excluding {
        createdBy,
        createdAt,
        modifiedBy,
        modifiedAt
    };
}
