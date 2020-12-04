namespace todo;

entity Tasks {
    key ID: Integer;
    uuid: UUID;
    value1: Double;
    value2: Decimal;
    value3: DecimalFloat;
    value4: Integer64;
    title: String;
    done: Boolean;
    items: Association to many TasksItems on items.task = $self;
    plannedTasks: Association to many PlannedTasks on plannedTasks.task = $self;
}

@cov2ap.isoTime
@cov2ap.isoDate
entity People {
    key ID: Integer;
    name: String;
    birthDate: Date;
    birthTime: Time;
    plannedTasks: Association to many PlannedTasks on plannedTasks.person = $self;
}

@cov2ap.isoDateTime
@cov2ap.isoTimestamp
@cov2ap.isoDateTimeOffset
entity PlannedTasks {
    key task: Association to Tasks;
    key person: Association to People;
    key startDate: DateTime;
    key endDate: DateTime;
    key keyDate: Date;
    key keyTime: Time;
    keyDateEdit: Date;
    keyTimeEdit: Time;
    tentative: Boolean;
}

entity TasksItems {
    key code: String;
    key task: Association to Tasks;
    text: String;
}

service TodoService {
    entity Tasks as projection on todo.Tasks;
    entity TasksItems as projection on todo.TasksItems;
    entity People as projection on todo.People;
    entity PlannedTasks as projection on todo.PlannedTasks;
}
