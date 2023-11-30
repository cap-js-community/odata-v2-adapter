namespace test;

using { managed } from '@sap/cds/common';
using test from './main';

@cov2ap.ignore
service IgnoreService {

    entity Header as projection on test.Header;
}