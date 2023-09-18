using test from './main';

@path: 'relative'
service RelativePathService {
    entity Header as projection on test.Header;
    entity HeaderItem as projection on test.HeaderItem;
}

@path: '/absolute'
service AbsolutePathService {
    entity Header as projection on test.Header;
    entity HeaderItem as projection on test.HeaderItem;
}

@path: 'relative2/complex/path'
service RelativeComplexPathService {
    entity Header as projection on test.Header;
    entity HeaderItem as projection on test.HeaderItem;
}

@path: '/absolute2/complex/path'
service AbsoluteComplexPathService {
    entity Header as projection on test.Header;
    entity HeaderItem as projection on test.HeaderItem;
}

@odata
@path: 'atodata'
service AtODataAnnotationService {
    entity Header as projection on test.Header;
    entity HeaderItem as projection on test.HeaderItem;
}

@rest
@path: 'atrest'
service AtRestAnnotationService {
    entity Header as projection on test.Header;
    entity HeaderItem as projection on test.HeaderItem;
}

@protocol: 'odata'
@path: 'atprotocolodata'
service AtProtocolODataAnnotationService {
    entity Header as projection on test.Header;
    entity HeaderItem as projection on test.HeaderItem;
}

@protocol: 'rest'
@path: 'atprotocolrest'
service AtProtocolRestAnnotationService {
    entity Header as projection on test.Header;
    entity HeaderItem as projection on test.HeaderItem;
}

@protocol: ['odata']
@path: 'atprotocollistodata'
service AtProtocolListAnnotationContainingODataService {
    entity Header as projection on test.Header;
    entity HeaderItem as projection on test.HeaderItem;
}

@protocol: ['rest']
@path: 'atprotocollistrest'
service AtProtocolListAnnotationNotContainingODataService {
    entity Header as projection on test.Header;
    entity HeaderItem as projection on test.HeaderItem;
}

@protocol: [{ kind: 'odata', path: 'relative2' }]
service AtProtocolObjectListWithAnnotationWithRelativePathService {
    entity Header as projection on test.Header;
    entity HeaderItem as projection on test.HeaderItem;
}

@protocol: [{ kind: 'odata', path: '/absolute2' }]
service AtProtocolObjectListWithAnnotationWithAbsolutePathService {
    entity Header as projection on test.Header;
    entity HeaderItem as projection on test.HeaderItem;
}

@protocol: [{ kind: 'odata', path: '/custom/odata/path' }]
service CustomService {
    entity Header as projection on test.Header;
    entity HeaderItem as projection on test.HeaderItem;
}

@protocol: [{ kind: 'odata-v4', path: '/custom2/odata/path' }]
service Custom2Service {
    entity Header as projection on test.Header;
    entity HeaderItem as projection on test.HeaderItem;
}

@protocol: [{ kind: 'odata-v4', path: 'odata' }]
service ODataService {
    entity Header as projection on test.Header;
    entity HeaderItem as projection on test.HeaderItem;
}

@protocol: [{ kind: 'odata-v4', path: '/odata' }] // needs to be registered last to match after "todo" service
service ODataService2 {
    entity Header as projection on test.Header;
    entity HeaderItem as projection on test.HeaderItem;
}

@protocol: [{ kind: 'odata-v4', path: '/odata/v4/odata' }]
service ODataService3 {
    entity Header as projection on test.Header;
    entity HeaderItem as projection on test.HeaderItem;
}