using test from './model.cds';

service DummyService {
    entity Header as projection on test.Header;
}
