namespace acme.cloud;

using {
  managed,
  sap.common
} from '@sap/cds/common';

entity Incidents : managed {
  key ID               : UUID                    @title : 'Incident number';
      title            : String(50)              @title : 'Title';
      category         : Association to Category @title : 'Category';
      priority         : Association to Priority @title : 'Priority';
      description      : String(1000)            @title : 'Description';
}

extend common.CodeList with {
  key code : String(20);
}

entity Category : common.CodeList {}
entity Priority : common.CodeList {}

service IncidentsService {

  entity Country as projection on common.Countries;
  entity Currency as projection on common.Currencies;

  entity Incidents as projection on cloud.Incidents;

  @readonly entity Category as projection on cloud.Category;
  @readonly entity Priority as projection on cloud.Priority;
}