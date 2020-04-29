service NavigateService {

    @cds.persistence.skip
	entity ChildSet {
		key Id: String;
		Keydate: String;
		Parent: String;
		Kind: String;
		Desc1: String;
		Desc2: String;
		Childrencount: Integer;
		Openplan: String;
		NextSeparator: String;
		WSApplications: String;
		Responsible: String;
		Redlining: String;
		ValidFrom: String;
		ValidTo: String;
	}

	@cds.persistence.skip
	function GetHierarchy(Child:String) returns array of ChildSet;
}