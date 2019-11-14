"use strict";

const supertest = require("supertest");
const fs = require("fs");

const env = require("./_env");
const util = require("./_env/util");
const init = require("./_env/data/init");

let context;
let request;

describe("todo-request", () => {
  beforeAll(async () => {
    context = await env("todomodel");
    request = supertest(context.app);
  });

  afterAll(() => {
    env.end(context);
  });

  it("CRUD test", async () => {
    let response = await util.callRead(request, "/v2/todo/People?$expand=plannedTasks", {
      accept: "application/json"
    });
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toMatchObject([
      {
        ID: 1,
        __metadata: {
          type: "todo.TodoService.People",
          uri: `http://${response.request.host}/v2/todo/People(1)`
        },
        name: "Joe",
        plannedTasks: {
          results: [
            {
              __metadata: {
                type: "todo.TodoService.PlannedTasks",
                uri: `http://${response.request.host}/v2/todo/PlannedTasks(startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',task_ID=1,person_ID=1)`
              },
              endDate: "/Date(1566518400000)/",
              person: {
                __deferred: {
                  uri: `http://${response.request.host}/v2/todo/PlannedTasks(startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',task_ID=1,person_ID=1)/person`
                }
              },
              person_ID: 1,
              startDate: "/Date(1566518400000)/",
              task: {
                __deferred: {
                  uri: `http://${response.request.host}/v2/todo/PlannedTasks(startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',task_ID=1,person_ID=1)/task`
                }
              },
              task_ID: 1,
              tentative: true
            }
          ]
        }
      },
      {
        ID: 2,
        __metadata: {
          type: "todo.TodoService.People",
          uri: `http://${response.request.host}/v2/todo/People(2)`
        },
        name: "Jane",
        plannedTasks: {
          results: []
        }
      },
      {
        ID: 3,
        __metadata: {
          type: "todo.TodoService.People",
          uri: `http://${response.request.host}/v2/todo/People(3)`
        },
        name: "Bob",
        plannedTasks: {
          results: [
            {
              __metadata: {
                type: "todo.TodoService.PlannedTasks",
                uri: `http://${response.request.host}/v2/todo/PlannedTasks(startDate=datetimeoffset'2019-08-24T00:00:00Z',endDate=datetimeoffset'2019-08-24T00:00:00Z',task_ID=2,person_ID=3)`
              },
              endDate: "/Date(1566604800000)/",
              person: {
                __deferred: {
                  uri: `http://${response.request.host}/v2/todo/PlannedTasks(startDate=datetimeoffset'2019-08-24T00:00:00Z',endDate=datetimeoffset'2019-08-24T00:00:00Z',task_ID=2,person_ID=3)/person`
                }
              },
              person_ID: 3,
              startDate: "/Date(1566604800000)/",
              task: {
                __deferred: {
                  uri: `http://${response.request.host}/v2/todo/PlannedTasks(startDate=datetimeoffset'2019-08-24T00:00:00Z',endDate=datetimeoffset'2019-08-24T00:00:00Z',task_ID=2,person_ID=3)/task`
                }
              },
              task_ID: 2,
              tentative: false
            }
          ]
        }
      }
    ]);
    const todo = response.body.d.results[0];
    response = await util.callRead(request, "/v2/todo/People(1)", {
      accept: "application/json"
    });
    expect(response.body.d).toBeDefined();
    expect(response.body.d.ID).toEqual(1);
    let plannedTaskUri = todo.plannedTasks.results[0].__metadata.uri;
    plannedTaskUri = plannedTaskUri.substr(`http://${response.request.host}`.length);
    response = await util.callRead(request, plannedTaskUri, {
      accept: "application/json"
    });
    expect(response.body.d).toBeDefined();
    expect(response.body.d).toEqual({
      __metadata: {
        type: "todo.TodoService.PlannedTasks",
        uri: `http://${response.request.host}/v2/todo/PlannedTasks(startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',task_ID=1,person_ID=1)`
      },
      endDate: "/Date(1566518400000)/",
      person: {
        __deferred: {
          uri: `http://${response.request.host}/v2/todo/PlannedTasks(startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',task_ID=1,person_ID=1)/person`
        }
      },
      person_ID: 1,
      startDate: "/Date(1566518400000)/",
      task: {
        __deferred: {
          uri: `http://${response.request.host}/v2/todo/PlannedTasks(startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',task_ID=1,person_ID=1)/task`
        }
      },
      task_ID: 1,
      tentative: true
    });
    response = await util.callWrite(
      request,
      plannedTaskUri,
      {
        tentative: false
      },
      true,
      {
        accept: "application/json"
      }
    );
    expect(response.statusCode).toEqual(200);
    response = await util.callRead(request, plannedTaskUri, {
      accept: "application/json"
    });
    expect(response.body.d).toBeDefined();
    expect(response.body.d).toEqual({
      __metadata: {
        type: "todo.TodoService.PlannedTasks",
        uri: `http://${response.request.host}/v2/todo/PlannedTasks(startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',task_ID=1,person_ID=1)`
      },
      endDate: "/Date(1566518400000)/",
      person: {
        __deferred: {
          uri: `http://${response.request.host}/v2/todo/PlannedTasks(startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',task_ID=1,person_ID=1)/person`
        }
      },
      person_ID: 1,
      startDate: "/Date(1566518400000)/",
      task: {
        __deferred: {
          uri: `http://${response.request.host}/v2/todo/PlannedTasks(startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',task_ID=1,person_ID=1)/task`
        }
      },
      task_ID: 1,
      tentative: false
    });
    response = await util.callDelete(request, plannedTaskUri);
    expect(response.statusCode).toEqual(204);
    response = await util.callRead(request, plannedTaskUri, {
      accept: "application/json"
    });
    expect(response.statusCode).toEqual(404);
    response = await util.callRead(request, "/v2/todo/People(1)?$expand=plannedTasks", {
      accept: "application/json"
    });
    expect(response.body).toBeDefined();
    expect(response.body.d).toMatchObject({
      ID: 1,
      __metadata: {
        type: "todo.TodoService.People",
        uri: `http://${response.request.host}/v2/todo/People(1)`
      },
      name: "Joe",
      plannedTasks: {
        results: []
      }
    });
  });
});
