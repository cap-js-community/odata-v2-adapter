namespace audit;

using sap.common from '@sap/cds/common';
using { managed, cuid } from '@sap/cds/common';

entity Audits: cuid, managed {
    audit_type: Association to one Audit_Types;
    work_activity: Association to one Work_Activities;
    start_date: DateTime;
    end_date: DateTime;
    auditor: String;
    audit_status: String;
    review_status: String;
}

entity Audit_Types {
    key ID: Integer;
    name: String;
    work_activities: Association to many Work_Activities on work_activities.audit_type = $self;
    hashToken: String(10);
}

entity Work_Activities {
    key ID: Integer;
    name: String;
    sap_close_out: Boolean;
    audit_type: Association to one Audit_Types;
    hashToken: String(10);
}

service AuditService {
  entity Country as projection on common.Countries;
  entity Currency as projection on common.Currencies;
  entity Audits as projection on audit.Audits;
  entity Audit_Types as projection on audit.Audit_Types;
  entity Work_Activities as projection on audit.Work_Activities;
}
