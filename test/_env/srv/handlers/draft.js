"use strict";

module.exports = (srv) => {
  const { Header, HeaderItem, ["HeaderItem.texts"]: HeaderItemText } = srv.entities("test.DraftService");

  srv.after("draftPrepare", Header.drafts, (data, req) => {
    const info = new Error("This is a Warning");
    info.code = "WARN01";
    info.target = "Header(ID=1b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/name";
    info.message = "An Warning occurred";
    info.numericSeverity = 3;
    req.info(info);
  });

  srv.after("UPDATE", Header.drafts, (data, req) => {
    const info1 = new Error("This is a Warning 1");
    info1.code = "WARN01";
    info1.target = "Header(ID=1b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/name";
    info1.message = "An Warning occurred 1";
    info1.numericSeverity = 3;
    req.info(info1);

    const info2 = new Error("This is a Warning 2");
    info2.code = "WARN02";
    info2.target = "/#TRANSIENT#";
    info2.message = "An Warning occurred 2";
    info2.numericSeverity = 3;
    req.info(info2);

    const info3 = new Error("This is a Warning 3");
    info3.code = "WARN03";
    info3.target = "/#TRANSIENT#/Header";
    info3.message = "An Warning occurred 3";
    info3.numericSeverity = 3;
    req.info(info3);
  });

  srv.after("READ", HeaderItem.drafts, (data, req) => {
    const info = new Error("This is a Warning");
    info.code = "WARN01";
    info.target = "Items(ID=2b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/name";
    info.message = "An Warning occurred";
    info.numericSeverity = 3;
    req.info(info);
  });

  srv.after("READ", HeaderItemText.drafts, (data, req) => {
    const info = new Error("This is a Warning");
    info.code = "WARN01";
    info.target =
      "Items(ID=2b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/texts(ID=3b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/description";
    info.message = "An Warning occurred";
    info.numericSeverity = 3;
    req.info(info);
  });
};
