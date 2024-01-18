namespace test;

using { managed } from '@sap/cds/common';
using test from './main';

service DraftService {

    type Result {
        name: String;
        code: String;
        age: Integer;
    }

    @odata.draft.enabled
    entity Header as projection on test.Header;
    entity HeaderItem as projection on test.HeaderItem;

    annotate DraftService.Header with {
        modifiedAt @odata.etag;
    }
}
