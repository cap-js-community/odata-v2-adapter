namespace test;

using { managed } from '@sap/cds/common';
using test from './model';

service DraftService {

    type Result {
        name: String;
        code: String;
        age: Integer;
    }

    entity Header as projection on test.Header;
    entity HeaderItem as projection on test.HeaderItem;

    annotate Header with @odata.draft.enabled;

    annotate managed with {
        modifiedAt @odata.etag;
    }
}
