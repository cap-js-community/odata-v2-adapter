"use strict";

module.exports = (srv) => {
  const { PlannedTasks } = srv.entities;

  srv.on("boundAction", PlannedTasks, async (req) => {
    return req.params[0];
  });

  srv.on("boundFunction", PlannedTasks, async (req) => {
    return JSON.stringify({ key: req.params[0], data: req.data });
  });

  srv.on("unboundAction", async (req) => {
    return {
      task_ID: 1,
      person_ID: 1,
      startDate: req.data.startDate2,
      endDate: req.data.endDate2,
      keyDate: req.data.keyDate2,
      keyTime: req.data.keyTime2,
    };
  });

  srv.on("unboundFunction", async (req) => {
    return JSON.stringify({ key: req.params[0], data: req.data });
  });
};
