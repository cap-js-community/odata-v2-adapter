namespace test;

using { managed } from '@sap/cds/common';
using test from './main';

@protocol: 'rest'
service RestService {

    entity Header as projection on test.Header;
}