"use strict";

const cds = require("@sap/cds");
const supertest = require("supertest");
// eslint-disable-next-line no-restricted-modules
const fs = require("fs");

const util = require("./_env/util/request");

cds.test(__dirname + "/_env");

let request;

describe("todo", () => {
  beforeAll(async () => {
    await global._init;
    request = supertest(cds.app.server);
  });

  it("GET request with datetime key", async () => {
    let response = await util.callRead(
      request,
      "/odata/v2/todo/PlannedTasks(task_ID=1,person_ID=1,startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',keyDate=datetime'2019-12-31T00:00:00',keyTime=time'PT12H34M56.789S')",
      {
        accept: "application/json",
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d).toMatchObject({
      task_ID: 1,
      person_ID: 1,
      startDate: "2019-08-23T00:00:00Z",
      endDate: "2019-08-23T00:00:00Z",
      keyDate: "/Date(1577750400000)/",
      keyTime: "PT12H34M56.789S",
      keyDateEdit: "/Date(1577750400000)/",
      keyTimeEdit: "PT12H34M56.789S",
      tentative: true,
      task: {
        __deferred: {},
      },
      person: {
        __deferred: {},
      },
      __metadata: {
        type: "todo.TodoService.PlannedTasks",
        uri: `http://${response.request.host.replace(
          "127.0.0.1",
          "localhost"
        )}/odata/v2/todo/PlannedTasks(task_ID=1,person_ID=1,startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',keyDate=datetime'2019-12-31T00:00:00',keyTime=time'PT12H34M56.789S')`,
      },
    });
    response = await util.callRead(
      request,
      "/odata/v2/todo/PlannedTasks(task_ID=1,person_ID=1,startDate=datetime'2019-08-23T00:00:00Z',endDate=datetime'2019-08-23T00:00:00Z',keyDate=datetime'2019-12-31T00:00:00',keyTime=time'PT12H34M56.789S')",
      {
        accept: "application/json",
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d).toMatchObject({
      task_ID: 1,
      person_ID: 1,
      startDate: "2019-08-23T00:00:00Z",
      endDate: "2019-08-23T00:00:00Z",
      keyDate: "/Date(1577750400000)/",
      keyTime: "PT12H34M56.789S",
      keyDateEdit: "/Date(1577750400000)/",
      keyTimeEdit: "PT12H34M56.789S",
      tentative: true,
      task: {
        __deferred: {},
      },
      person: {
        __deferred: {},
      },
      __metadata: {
        type: "todo.TodoService.PlannedTasks",
        uri: `http://${response.request.host.replace(
          "127.0.0.1",
          "localhost"
        )}/odata/v2/todo/PlannedTasks(task_ID=1,person_ID=1,startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',keyDate=datetime'2019-12-31T00:00:00',keyTime=time'PT12H34M56.789S')`,
      },
    });
    response = await util.callRead(
      request,
      "/odata/v2/todo/PlannedTasks(task_ID=1,person_ID=1,startDate=datetimeoffset'2019-08-23T00%3A00%3A00Z',endDate=datetimeoffset'2019-08-23T00%3A00%3A00Z',keyDate=datetime'2019-12-31T00%3A00%3A00',keyTime=time'PT12H34M56.789S')",
      {
        accept: "application/json",
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d).toMatchObject({
      task_ID: 1,
      person_ID: 1,
      startDate: "2019-08-23T00:00:00Z",
      endDate: "2019-08-23T00:00:00Z",
      keyDate: "/Date(1577750400000)/",
      keyTime: "PT12H34M56.789S",
      keyDateEdit: "/Date(1577750400000)/",
      keyTimeEdit: "PT12H34M56.789S",
      tentative: true,
      task: {
        __deferred: {},
      },
      person: {
        __deferred: {},
      },
      __metadata: {
        type: "todo.TodoService.PlannedTasks",
      },
    });
  });

  it("GET request with datetime key (batch)", async () => {
    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-GET-DateTime.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    let response = await util.callMultipart(request, "/odata/v2/todo/$batch", payload);
    expect(response.statusCode).toEqual(202);
    const responses = util.splitMultipartResponse(response.body);
    expect(responses).toHaveLength(3);
    const [first, second, third] = responses;
    expect(first.body.d.results).toHaveLength(3);
    expect(second.body.d).toMatchObject({
      task_ID: 1,
      person_ID: 1,
      startDate: "2019-08-23T00:00:00Z",
      endDate: "2019-08-23T00:00:00Z",
      keyDate: "/Date(1577750400000)/",
      keyTime: "PT12H34M56.789S",
      keyDateEdit: "/Date(1577750400000)/",
      keyTimeEdit: "PT12H34M56.789S",
      tentative: true,
      task: {
        __deferred: {},
      },
      person: {
        __deferred: {},
      },
      __metadata: {
        type: "todo.TodoService.PlannedTasks",
      },
    });
    expect(third.body.d).toMatchObject({
      task_ID: 1,
      person_ID: 1,
      startDate: "2019-08-23T00:00:00Z",
      endDate: "2019-08-23T00:00:00Z",
      keyDate: "/Date(1577750400000)/",
      keyTime: "PT12H34M56.789S",
      keyDateEdit: "/Date(1577750400000)/",
      keyTimeEdit: "PT12H34M56.789S",
      tentative: true,
      task: {
        __deferred: {},
      },
      person: {
        __deferred: {},
      },
      __metadata: {
        type: "todo.TodoService.PlannedTasks",
      },
    });
  });

  it("CRUD test", async () => {
    let response = await util.callRead(request, "/odata/v2/todo/People?$expand=plannedTasks", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.body.d.results).toMatchObject([
      {
        ID: 1,
        __metadata: {
          type: "todo.TodoService.People",
          uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/todo/People(1)`,
        },
        name: "Joe",
        birthDate: "1990-07-01",
        birthTime: "12:13:14",
        plannedTasks: {
          results: [
            {
              __metadata: {
                type: "todo.TodoService.PlannedTasks",
                uri: `http://${response.request.host.replace(
                  "127.0.0.1",
                  "localhost"
                )}/odata/v2/todo/PlannedTasks(task_ID=1,person_ID=1,startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',keyDate=datetime'2019-12-31T00:00:00',keyTime=time'PT12H34M56.789S')`,
              },
              endDate: "2019-08-23T00:00:00Z",
              person: {
                __deferred: {
                  uri: `http://${response.request.host.replace(
                    "127.0.0.1",
                    "localhost"
                  )}/odata/v2/todo/PlannedTasks(task_ID=1,person_ID=1,startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',keyDate=datetime'2019-12-31T00:00:00',keyTime=time'PT12H34M56.789S')/person`,
                },
              },
              person_ID: 1,
              startDate: "2019-08-23T00:00:00Z",
              task: {
                __deferred: {
                  uri: `http://${response.request.host.replace(
                    "127.0.0.1",
                    "localhost"
                  )}/odata/v2/todo/PlannedTasks(task_ID=1,person_ID=1,startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',keyDate=datetime'2019-12-31T00:00:00',keyTime=time'PT12H34M56.789S')/task`,
                },
              },
              task_ID: 1,
              tentative: true,
            },
          ],
        },
      },
      {
        ID: 2,
        __metadata: {
          type: "todo.TodoService.People",
          uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/todo/People(2)`,
        },
        name: "Jane",
        birthDate: "1981-08-14",
        birthTime: "08:15:18",
        plannedTasks: {
          results: [],
        },
      },
      {
        ID: 3,
        __metadata: {
          type: "todo.TodoService.People",
          uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/todo/People(3)`,
        },
        name: "Bob",
        birthDate: "1978-01-05",
        birthTime: "11:14:56",
        plannedTasks: {
          results: [
            {
              __metadata: {
                type: "todo.TodoService.PlannedTasks",
                uri: `http://${response.request.host.replace(
                  "127.0.0.1",
                  "localhost"
                )}/odata/v2/todo/PlannedTasks(task_ID=2,person_ID=3,startDate=datetimeoffset'2019-08-24T00:00:00Z',endDate=datetimeoffset'2019-08-24T00:00:00Z',keyDate=datetime'2019-12-31T00:00:00',keyTime=time'PT12H34M56.7S')`,
              },
              endDate: "2019-08-24T00:00:00Z",
              person: {
                __deferred: {
                  uri: `http://${response.request.host.replace(
                    "127.0.0.1",
                    "localhost"
                  )}/odata/v2/todo/PlannedTasks(task_ID=2,person_ID=3,startDate=datetimeoffset'2019-08-24T00:00:00Z',endDate=datetimeoffset'2019-08-24T00:00:00Z',keyDate=datetime'2019-12-31T00:00:00',keyTime=time'PT12H34M56.7S')/person`,
                },
              },
              person_ID: 3,
              startDate: "2019-08-24T00:00:00Z",
              task: {
                __deferred: {
                  uri: `http://${response.request.host.replace(
                    "127.0.0.1",
                    "localhost"
                  )}/odata/v2/todo/PlannedTasks(task_ID=2,person_ID=3,startDate=datetimeoffset'2019-08-24T00:00:00Z',endDate=datetimeoffset'2019-08-24T00:00:00Z',keyDate=datetime'2019-12-31T00:00:00',keyTime=time'PT12H34M56.7S')/task`,
                },
              },
              task_ID: 2,
              tentative: false,
            },
          ],
        },
      },
    ]);
    const todo = response.body.d.results[0];
    response = await util.callRead(request, "/odata/v2/todo/People(1)", {
      accept: "application/json",
    });
    expect(response.body.d).toBeDefined();
    expect(response.body.d.ID).toEqual(1);
    let plannedTaskUri = todo.plannedTasks.results[0].__metadata.uri;
    plannedTaskUri = plannedTaskUri.substr(`http://${response.request.host.replace("127.0.0.1", "localhost")}`.length);
    response = await util.callRead(request, plannedTaskUri, {
      accept: "application/json",
    });
    expect(response.body.d).toBeDefined();
    expect(response.body.d).toEqual({
      __metadata: {
        type: "todo.TodoService.PlannedTasks",
        uri: `http://${response.request.host.replace(
          "127.0.0.1",
          "localhost"
        )}/odata/v2/todo/PlannedTasks(task_ID=1,person_ID=1,startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',keyDate=datetime'2019-12-31T00:00:00',keyTime=time'PT12H34M56.789S')`,
      },
      endDate: "2019-08-23T00:00:00Z",
      person: {
        __deferred: {
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost"
          )}/odata/v2/todo/PlannedTasks(task_ID=1,person_ID=1,startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',keyDate=datetime'2019-12-31T00:00:00',keyTime=time'PT12H34M56.789S')/person`,
        },
      },
      person_ID: 1,
      startDate: "2019-08-23T00:00:00Z",
      task: {
        __deferred: {
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost"
          )}/odata/v2/todo/PlannedTasks(task_ID=1,person_ID=1,startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',keyDate=datetime'2019-12-31T00:00:00',keyTime=time'PT12H34M56.789S')/task`,
        },
      },
      keyDate: "/Date(1577750400000)/",
      keyTime: "PT12H34M56.789S",
      keyDateEdit: "/Date(1577750400000)/",
      keyTimeEdit: "PT12H34M56.789S",
      task_ID: 1,
      tentative: true,
    });
    response = await util.callWrite(
      request,
      plannedTaskUri,
      {
        tentative: false,
        keyDateEdit: "/Date(1577836800000)/",
        keyTimeEdit: "P00DT13H35M57.99S",
      },
      true,
      {
        accept: "application/json",
      }
    );
    expect(response.statusCode).toEqual(200);
    response = await util.callRead(request, plannedTaskUri, {
      accept: "application/json",
    });
    expect(response.body.d).toBeDefined();
    expect(response.body.d).toEqual({
      __metadata: {
        type: "todo.TodoService.PlannedTasks",
        uri: `http://${response.request.host.replace(
          "127.0.0.1",
          "localhost"
        )}/odata/v2/todo/PlannedTasks(task_ID=1,person_ID=1,startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',keyDate=datetime'2019-12-31T00:00:00',keyTime=time'PT12H34M56.789S')`,
      },
      endDate: "2019-08-23T00:00:00Z",
      person: {
        __deferred: {
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost"
          )}/odata/v2/todo/PlannedTasks(task_ID=1,person_ID=1,startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',keyDate=datetime'2019-12-31T00:00:00',keyTime=time'PT12H34M56.789S')/person`,
        },
      },
      person_ID: 1,
      startDate: "2019-08-23T00:00:00Z",
      task: {
        __deferred: {
          uri: `http://${response.request.host.replace(
            "127.0.0.1",
            "localhost"
          )}/odata/v2/todo/PlannedTasks(task_ID=1,person_ID=1,startDate=datetimeoffset'2019-08-23T00:00:00Z',endDate=datetimeoffset'2019-08-23T00:00:00Z',keyDate=datetime'2019-12-31T00:00:00',keyTime=time'PT12H34M56.789S')/task`,
        },
      },
      keyDate: "/Date(1577750400000)/",
      keyTime: "PT12H34M56.789S",
      keyDateEdit: "/Date(1577836800000)/",
      keyTimeEdit: "PT13H35M57.99S",
      task_ID: 1,
      tentative: false,
    });
    response = await util.callDelete(request, plannedTaskUri);
    expect(response.statusCode).toEqual(204);
    response = await util.callRead(request, plannedTaskUri, {
      accept: "application/json",
    });
    expect(response.statusCode).toEqual(404);
    response = await util.callRead(request, "/odata/v2/todo/People(1)?$expand=plannedTasks", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.body.d).toMatchObject({
      ID: 1,
      __metadata: {
        type: "todo.TodoService.People",
        uri: `http://${response.request.host.replace("127.0.0.1", "localhost")}/odata/v2/todo/People(1)`,
      },
      name: "Joe",
      plannedTasks: {
        results: [],
      },
    });
  });

  it("Filter expression on data types", async () => {
    let response = await util.callRead(
      request,
      "/odata/v2/todo/Tasks?$filter=uuid eq guid'05db01e5-28e6-4668-9fdb-7da666c2eec8' or title eq 'ABC' or value1 ge 5.5d",
      {
        accept: "application/json",
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(
      request,
      "/odata/v2/todo/Tasks?$filter=value1 eq 0.9d or title eq 'ABC' or value1 ge 5.5d",
      {
        accept: "application/json",
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(
      request,
      "/odata/v2/todo/Tasks?$filter=title eq 'ABC' or value1 ge 5.5d or value2 eq 1.1m",
      {
        accept: "application/json",
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(
      request,
      "/odata/v2/todo/Tasks?$filter=value3 eq 1.2f or title eq 'ABC' or value1 ge 5.5d",
      {
        accept: "application/json",
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(request, "/odata/v2/todo/Tasks?$filter=value4 eq 3L or title eq 'ABC' or value1 ge 5.5d", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(
      request,
      "/odata/v2/todo/People(3)/plannedTasks?$filter=startDate eq datetimeoffset'2019-08-24T00:00:00Z'",
      {
        accept: "application/json",
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(
      request,
      "/odata/v2/todo/People(3)/plannedTasks?$filter=startDate le datetimeoffset'2019-08-24T00:00:00Z' or startDate ge datetimeoffset'2019-08-24T00:00:00Z'",
      {
        accept: "application/json",
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(
      request,
      "/odata/v2/todo/People(3)/plannedTasks?$filter=keyDate eq datetime'2019-12-31T00:00:00' or tentative eq true",
      {
        accept: "application/json",
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(
      request,
      "/odata/v2/todo/People(3)/plannedTasks?$filter=keyDate le datetime'2019-12-31T00:00:00' or keyDate ge datetime'2019-12-31T00:00:00' or tentative eq true",
      {
        accept: "application/json",
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(
      request,
      "/odata/v2/todo/People(3)/plannedTasks?$filter=keyDate le datetime'2019-12-31T00:00Z' or keyDate ge datetime'2019-12-31T00:00Z' or tentative eq true",
      {
        accept: "application/json",
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(
      request,
      "/odata/v2/todo/People(3)/plannedTasks?$filter=tentative eq true or keyTime eq time'PT12H34M56.7S'",
      {
        accept: "application/json",
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(
      request,
      "/odata/v2/todo/People(3)/plannedTasks?$filter=tentative eq true or day(keyDate) eq 31",
      {
        accept: "application/json",
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(request, "/odata/v2/todo/Tasks?$filter=round(value1) eq 1d", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
  });

  it("Filter expression on data types with quotes", async () => {
    let response = await util.callRead(
      request,
      "/odata/v2/todo/Tasks?$filter=uuid eq guid'05db01e5-28e6-4668-9fdb-7da666c2eec8' or uuid eq guid'775863cf-9bf2-42a3-ac07-caf67a0b7955'",
      {
        accept: "application/json",
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(2);
    response = await util.callRead(
      request,
      "/odata/v2/todo/Tasks?$filter=uuid eq guid'05db01e5-28e6-4668-9fdb-7da666c2eec8' and title eq 'guid''05db01e5-28e6-4668-9fdb-7da666c2eec8'''",
      {
        accept: "application/json",
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(0);
    response = await util.callRead(
      request,
      "/odata/v2/todo/Tasks?$filter=((value4 eq 3L or title eq 'ABC' or value1 ge 5.5d or uuid eq guid'05db01e5-28e6-4668-9fdb-7da666c2eec8') and (title eq 'guid''05db01e5-28e6-4668-9fdb-7da666c2eec8''''' or uuid eq guid'05db01e5-28e6-4668-9fdb-7da666c2eec8' or value2 ge 5.5m))",
      {
        accept: "application/json",
      }
    );
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(1);
    response = await util.callRead(request, "/odata/v2/todo/Tasks?$filter='''ABC''''' ne title or value4 eq 3L", {
      accept: "application/json",
    });
    expect(response.body).toBeDefined();
    expect(response.body.d.results.length).toEqual(2);
  });

  it("tests IEEE754Compatible on decimals", async () => {
    let response = await util.callRead(request, "/odata/v2/todo/Tasks(1)", {
      accept: "application/json",
    });
    expect(response.body.d).toBeDefined();
    expect(response.body.d.ID).toEqual(1);
    expect(response.body.d.value2).toEqual("1.6");
    let taskUri = response.body.d.__metadata.uri;
    response = await util.callWrite(
      request,
      "/odata/v2/todo/Tasks(1)",
      {
        value2: "1.61",
      },
      true,
      {
        "content-type": "application/json",
        accept: "application/json",
      }
    );
    expect(response.statusCode).toEqual(200);
    response = await util.callRead(request, "/odata/v2/todo/Tasks(1)", {
      accept: "application/json",
    });
    expect(response.body.d).toBeDefined();
    expect(response.body.d.ID).toEqual(1);
    expect(response.body.d.value2).toEqual("1.61");

    let payload = fs.readFileSync(__dirname + "/_env/util/batch/Batch-PUT-Decimal.txt", "utf8");
    payload = payload.replace(/\r\n/g, "\n");
    response = await util.callMultipart(request, "/odata/v2/todo/$batch", payload);
    expect(response.statusCode).toEqual(202);
    response = await util.callRead(request, "/odata/v2/todo/Tasks(1)", {
      accept: "application/json",
    });
    expect(response.body.d).toBeDefined();
    expect(response.body.d.ID).toEqual(1);
    expect(response.body.d.value2).toEqual("1.62");
  });

  it("Call bound action/function with date/time parameters", async () => {
    let response = await util.callWrite(request, "/odata/v2/todo/PlannedTasks", {
      task_ID: 1,
      person_ID: 1,
      startDate: "2020-08-23T00:00:00Z",
      endDate: "2020-08-23T00:00:00Z",
      keyDate: "/Date(1577750400000)/",
      keyTime: "PT12H34M56.789S",
      keyDateEdit: "/Date(1577750400000)/",
      keyTimeEdit: "PT12H34M56.789S",
      tentative: true,
    });
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    response = await util.callWrite(
      request,
      "/odata/v2/todo/PlannedTasks_boundAction?task_ID=1&person_ID=1&num=1&text=abc&startDate=datetimeoffset'2019-08-23T00:00:00Z'&endDate=datetimeoffset'2019-08-23T00:00:00Z'&keyDate=datetime'2019-12-31T00:00:00'&keyTime=time'PT12H34M56.789S'&startDate2=datetimeoffset'2019-08-23T00:00:00Z'&endDate2=datetimeoffset'2019-08-23T00:00:00Z'&keyDate2=datetime'2019-12-31T00:00:00'&keyTime2=time'PT12H34M56.789S'"
    );
    expect(response.body).toMatchObject({
      d: {
        task_ID: 1,
        person_ID: 1,
        startDate: "2019-08-23T00:00:00Z",
        endDate: "2019-08-23T00:00:00Z",
        keyDate: "/Date(1577750400000)/",
        keyTime: "PT12H34M56.789S",
      },
    });
    response = await util.callRead(
      request,
      "/odata/v2/todo/PlannedTasks_boundFunction?task_ID=1&person_ID=1&num=1&text=abc&startDate=datetimeoffset'2019-08-23T00:00:00Z'&endDate=datetimeoffset'2019-08-23T00:00:00Z'&keyDate=datetime'2019-12-31T00:00:00'&keyTime=time'PT12H34M56.789S'&startDate2=datetimeoffset'2019-08-23T00:00:00Z'&endDate2=datetimeoffset'2019-08-23T00:00:00Z'&keyDate2=datetime'2019-12-31T00:00:00'&keyTime2=time'PT12H34M56.789S'"
    );
    expect(response.body).toMatchObject({
      d: {
        PlannedTasks_boundFunction: JSON.stringify({
          key: {
            task_ID: 1,
            person_ID: 1,
            startDate: "2019-08-23T00:00:00Z",
            endDate: "2019-08-23T00:00:00Z",
            keyDate: "2019-12-31",
            keyTime: "12:34:56.789",
          },
          data: {
            num: 1,
            text: "abc",
            startDate2: "2019-08-23T00:00:00Z",
            endDate2: "2019-08-23T00:00:00Z",
            keyDate2: "2019-12-31",
            keyTime2: "12:34:56.789",
          },
        }),
      },
    });
  });

  it("Call unbound action/function with date/time parameters", async () => {
    let response = await util.callWrite(request, "/odata/v2/todo/PlannedTasks", {
      task_ID: 1,
      person_ID: 1,
      startDate: "2021-08-23T00:00:00Z",
      endDate: "2021-08-23T00:00:00Z",
      keyDate: "/Date(1577750400000)/",
      keyTime: "PT12H34M56.789S",
      keyDateEdit: "/Date(1577750400000)/",
      keyTimeEdit: "PT12H34M56.789S",
      tentative: true,
    });
    expect(response.body).toBeDefined();
    expect(response.body.d).toBeDefined();
    response = await util.callWrite(
      request,
      "/odata/v2/todo/unboundAction?num=1&text=abc&&startDate2=datetimeoffset'2019-08-23T00:00:00Z'&endDate2=datetimeoffset'2019-08-23T00:00:00Z'&keyDate2=datetime'2019-12-31T00:00:00'&keyTime2=time'PT12H34M56.789S'"
    );
    expect(response.body).toMatchObject({
      d: {
        task_ID: 1,
        person_ID: 1,
        startDate: "2019-08-23T00:00:00Z",
        endDate: "2019-08-23T00:00:00Z",
        keyDate: "/Date(1577750400000)/",
        keyTime: "PT12H34M56.789S",
      },
    });
    response = await util.callRead(
      request,
      "/odata/v2/todo/unboundFunction?num=1&text=abc&&startDate2=datetimeoffset'2019-08-23T00:00:00Z'&endDate2=datetimeoffset'2019-08-23T00:00:00Z'&keyDate2=datetime'2019-12-31T00:00:00'&keyTime2=time'PT12H34M56.789S'"
    );
    expect(response.body).toMatchObject({
      d: {
        unboundFunction: JSON.stringify({
          key: undefined,
          data: {
            num: 1,
            text: "abc",
            startDate2: "2019-08-23T00:00:00Z",
            endDate2: "2019-08-23T00:00:00Z",
            keyDate2: "2019-12-31",
            keyTime2: "12:34:56.789",
          },
        }),
      },
    });
  });
});
