namespace test;

entity tasks {
    key urn: String(300);
}

@protocol: [{
    kind: 'odata-v4', path: '/task-provider'
}, {
    kind: 'odata-v2', path: '/task-provider/v2'
}]
service TaskProviderService {

    entity tasks as projection on test.tasks;
}
