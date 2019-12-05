using test from './model.cds';

service DummyService {
    entity Header as projection on test.Header;
    entity HeaderItem as projection on test.HeaderItem;
}
