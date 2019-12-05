namespace todo;

entity Tasks {
    key ID: Integer;
    title: String;
    done: Boolean;
    items: Association to many TasksItems on items.task = $self;
    plannedTasks: Association to many PlannedTasks on plannedTasks.task = $self;
}

entity People {
    key ID: Integer;
    name: String;
    plannedTasks: Association to many PlannedTasks on plannedTasks.person = $self;
}

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
