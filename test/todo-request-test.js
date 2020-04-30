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
                uri: `http://${response.request.host}/v2/todo/PlannedTasks(startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',keyDate=datetime'2019-12-31T00:00',keyTime=time'PT12H34M56.789S',task_ID=1,person_ID=1)`
              },
              endDate: "/Date(1566518400000)/",
              person: {
                __deferred: {
                  uri: `http://${response.request.host}/v2/todo/PlannedTasks(startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',keyDate=datetime'2019-12-31T00:00',keyTime=time'PT12H34M56.789S',task_ID=1,person_ID=1)/person`
                }
              },
              person_ID: 1,
              startDate: "/Date(1566518400000)/",
              task: {
                __deferred: {
                  uri: `http://${response.request.host}/v2/todo/PlannedTasks(startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',keyDate=datetime'2019-12-31T00:00',keyTime=time'PT12H34M56.789S',task_ID=1,person_ID=1)/task`
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
                uri: `http://${response.request.host}/v2/todo/PlannedTasks(startDate=datetimeoffset'2019-08-24T00:00:00Z',endDate=datetimeoffset'2019-08-24T00:00:00Z',keyDate=datetime'2019-12-31T00:00',keyTime=time'PT12H34M56.7S',task_ID=2,person_ID=3)`
              },
              endDate: "/Date(1566604800000)/",
              person: {
                __deferred: {
                  uri: `http://${response.request.host}/v2/todo/PlannedTasks(startDate=datetimeoffset'2019-08-24T00:00:00Z',endDate=datetimeoffset'2019-08-24T00:00:00Z',keyDate=datetime'2019-12-31T00:00',keyTime=time'PT12H34M56.7S',task_ID=2,person_ID=3)/person`
                }
              },
              person_ID: 3,
              startDate: "/Date(1566604800000)/",
              task: {
                __deferred: {
                  uri: `http://${response.request.host}/v2/todo/PlannedTasks(startDate=datetimeoffset'2019-08-24T00:00:00Z',endDate=datetimeoffset'2019-08-24T00:00:00Z',keyDate=datetime'2019-12-31T00:00',keyTime=time'PT12H34M56.7S',task_ID=2,person_ID=3)/task`
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
        uri: `http://${response.request.host}/v2/todo/PlannedTasks(startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',keyDate=datetime'2019-12-31T00:00',keyTime=time'PT12H34M56.789S',task_ID=1,person_ID=1)`
      },
      endDate: "/Date(1566518400000)/",
      person: {
        __deferred: {
          uri: `http://${response.request.host}/v2/todo/PlannedTasks(startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',keyDate=datetime'2019-12-31T00:00',keyTime=time'PT12H34M56.789S',task_ID=1,person_ID=1)/person`
        }
      },
      person_ID: 1,
      startDate: "/Date(1566518400000)/",
      task: {
        __deferred: {
          uri: `http://${response.request.host}/v2/todo/PlannedTasks(startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',keyDate=datetime'2019-12-31T00:00',keyTime=time'PT12H34M56.789S',task_ID=1,person_ID=1)/task`
        }
      },
      keyDate: "/Date(1577750400000)/",
      keyTime: "PT12H34M56.789S",
      keyDateEdit: "/Date(1577750400000)/",
      keyTimeEdit: "PT12H34M56.789S",
      task_ID: 1,
      tentative: true
    });
    response = await util.callWrite(
      request,
      plannedTaskUri,
      {
        tentative: false,
        keyDateEdit: "/Date(1577836800000)/",
        keyTimeEdit: "P00DT13H35M57.99S"
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
        uri: `http://${response.request.host}/v2/todo/PlannedTasks(startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',keyDate=datetime'2019-12-31T00:00',keyTime=time'PT12H34M56.789S',task_ID=1,person_ID=1)`
      },
      endDate: "/Date(1566518400000)/",
      person: {
        __deferred: {
          uri: `http://${response.request.host}/v2/todo/PlannedTasks(startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',keyDate=datetime'2019-12-31T00:00',keyTime=time'PT12H34M56.789S',task_ID=1,person_ID=1)/person`
        }
      },
      person_ID: 1,
      startDate: "/Date(1566518400000)/",
      task: {
        __deferred: {
          uri: `http://${response.request.host}/v2/todo/PlannedTasks(startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',keyDate=datetime'2019-12-31T00:00',keyTime=time'PT12H34M56.789S',task_ID=1,person_ID=1)/task`
        }
      },
      keyDate: "/Date(1577750400000)/",
      keyTime: "PT12H34M56.789S",
      keyDateEdit: "/Date(1577836800000)/",
      keyTimeEdit: "PT13H35M57.99S",
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

  it("Filter expression on data types", async () => {
    let response = await util.callRead(
      request,
      "/v2/todo/Tasks?$filter=uuid eq guid'05db01e5-28e6-4668-9fdb-7da666c2eec8' or title eq 'ABC' or value1 ge 5.5d",
      {
        accept: "application/json"
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(
      request,
      "/v2/todo/Tasks?$filter=value1 eq 0.9d or title eq 'ABC' or value1 ge 5.5d",
      {
        accept: "application/json"
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(
      request,
      "/v2/todo/Tasks?$filter=title eq 'ABC' or value1 ge 5.5d or value2 eq 1.1m",
      {
        accept: "application/json"
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(
      request,
      "/v2/todo/Tasks?$filter=value3 eq 1.2f or title eq 'ABC' or value1 ge 5.5d",
      {
        accept: "application/json"
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(request, "/v2/todo/Tasks?$filter=value4 eq 3L or title eq 'ABC' or value1 ge 5.5d", {
      accept: "application/json"
    });
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(
      request,
      "/v2/todo/People(3)/plannedTasks?$filter=startDate eq datetimeoffset'2019-08-24T00:00:00Z'",
      {
        accept: "application/json"
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(
      request,
      "/v2/todo/People(3)/plannedTasks?$filter=startDate le datetimeoffset'2019-08-24T00:00:00Z' or startDate ge datetimeoffset'2019-08-24T00:00:00Z'",
      {
        accept: "application/json"
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(
      request,
      "/v2/todo/People(3)/plannedTasks?$filter=keyDate eq datetime'2019-12-31T00:00' or tentative eq true",
      {
        accept: "application/json"
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(
      request,
      "/v2/todo/People(3)/plannedTasks?$filter=keyDate le datetime'2019-12-31T00:00' or keyDate ge datetime'2019-12-31T00:00' or tentative eq true",
      {
        accept: "application/json"
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(
      request,
      "/v2/todo/People(3)/plannedTasks?$filter=tentative eq true or keyTime eq time'PT12H34M56.7S'",
      {
        accept: "application/json"
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(
      request,
      "/v2/todo/People(3)/plannedTasks?$filter=tentative eq true or day(keyDate) eq 31",
      {
        accept: "application/json"
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
  });

  it("Filter expression on data types with quotes", async () => {
    let response = await util.callRead(
      request,
      "/v2/todo/Tasks?$filter=uuid eq guid'05db01e5-28e6-4668-9fdb-7da666c2eec8' or uuid eq guid'775863cf-9bf2-42a3-ac07-caf67a0b7955'",
      {
        accept: "application/json"
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(2);
    response = await util.callRead(
      request,
      "/v2/todo/Tasks?$filter=uuid eq guid'05db01e5-28e6-4668-9fdb-7da666c2eec8' and title eq 'guid''05db01e5-28e6-4668-9fdb-7da666c2eec8'''",
      {
        accept: "application/json"
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(0);
    response = await util.callRead(
      request,
      "/v2/todo/Tasks?$filter=((value4 eq 3L or title eq 'ABC' or value1 ge 5.5d or uuid eq guid'05db01e5-28e6-4668-9fdb-7da666c2eec8') and (title eq 'guid''05db01e5-28e6-4668-9fdb-7da666c2eec8''''' or uuid eq guid'05db01e5-28e6-4668-9fdb-7da666c2eec8' or value2 ge 5.5m))",
      {
        accept: "application/json"
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(request, "/v2/todo/Tasks?$filter='''ABC''''' ne title or value4 eq 3L", {
      accept: "application/json"
    });
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(2);
  });

  it("tests IEEE754Compatible on decimals", async () => {
    let response = await util.callRead(request, "/v2/todo/Tasks(1)", {
      accept: "application/json"
    });
    expect(response.body.d).toBeDefined();
    expect(response.body.d.ID).toEqual(1);
    expect(response.body.d.value2).toEqual("1.6");
    let taskUri = response.body.d.__metadata.uri;
    response = await util.callWrite(
      request,
      "/v2/todo/Tasks(1)",
      {
        value2: "1.61"
      },
      true,
      {
        "content-type": "application/json",
        accept: "application/json"
      }
    );
    expect(response.statusCode).toEqual(200);
    response = await util.callRead(request, "/v2/todo/Tasks(1)", {
      accept: "application/json"
    });
    expect(response.body.d).toBeDefined();
    expect(response.body.d.ID).toEqual(1);
    expect(response.body.d.value2).toEqual("1.61");

    let payload = fs.readFileSync("./test/_env/data/batch/Batch-PUT-Decimal.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    response = await util.callMultipart(request, "/v2/todo/$batch", payload);
    expect(response.statusCode).toEqual(200);
    response = await util.callRead(request, "/v2/todo/Tasks(1)", {
      accept: "application/json"
    });
    expect(response.body.d).toBeDefined();
    expect(response.body.d.ID).toEqual(1);
    expect(response.body.d.value2).toEqual("1.62");
  });
});
