namespace test;

using { test as testModel } from '../db/model';

service MainService {
   entity Header as projection on test.Header;
}