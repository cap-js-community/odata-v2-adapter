"use strict";

module.exports = (srv) => {
  srv.on("GetHierarchy", async (req) => {
    return [
      {
        Id: "TEST",
      },
    ];
  });
};
