using test from './main';

@path: 'a/b-c/d'
service PathService {
    entity Header as projection on test.Header;
    entity HeaderItem as projection on test.HeaderItem;
}
