using test.MainService from '../../test/_env/model.cds';

annotate MainService.Node {
    nodeID @sap.hierarchy.node.for;
    hierarchyLevel @sap.hierarchy.level.for;
    parentNodeID @sap.hierarchy.parent.node.for;
    drillState @sap.hierarchy.drill.state.for;
}

annotate MainService.Node with @(
    UI: {
        Identification: [
            { Value: description }
        ],
        SelectionFields: [ description ],
        LineItem: [
            { $Type: 'UI.DataField', Value: description, Label: 'Description' }
        ],
        HeaderInfo: {
            $Type: 'UI.HeaderInfoType',
            TypeName: 'Node',
            TypeNamePlural: 'Nodes',
            Title: { Value: description },
            Description: { Value: description }
        }
    }
);
