module.exports = srv => {
  const { Header } = srv.entities("test.MainService");

  srv.on("test.MainService.unboundFunction", async req => {
    return {
      code: "TEST",
      name: req.data.text,
      age: req.data.num
    };
  });

  srv.on("test.MainService.unboundDecimalFunction", async req => {
    return 12345.6789;
  });

  srv.on("test.MainService.unboundDecimalsFunction", async req => {
    return [12345.6789, 12345.6789];
  });

  srv.on("test.MainService.unboundErrorFunction", async req => {
    const error = new Error("An error occurred");
    error.code = "ERR01";
    error.target = "Items";
    error.message = "An error occurred";
    error.severity = 4;
    error["@Common.numericSeverity"] = 4;
    error.details = [
      {
        code: "ERR02",
        target: "Items",
        message: "Error details",
        "@Common.numericSeverity": 4
      }
    ];
    req.error(400, error);
  });

  srv.on("test.MainService.unboundWarningFunction", async req => {
    const info = new Error("This is a warning");
    info.code = "WARN01";
    info.target = "Items";
    info.message = "An Warning occurred";
    info.numericSeverity = 3;
    req.info(info);
    return {
      name: "Test",
      code: "TEST",
      age: 1
    };
  });

  srv.on("test.MainService.unboundNavigationFunction", async req => {
    return req.run(SELECT.from("test.MainService.Header").where({ ID: req.data.text }));
  });

  srv.on("test.MainService.unboundNavigationsFunction", async req => {
    return req.run(SELECT.from("test.MainService.Header"));
  });

  srv.on("test.MainService.unboundAction", async req => {
    return [
      {
        code: "TEST",
        name: req.data.text,
        age: req.data.num
      }
    ];
  });

  srv.on("boundFunction", Header, async req => {
    return [
      {
        code: "TEST",
        name: req.data.text,
        age: req.data.num
      }
    ];
  });

  srv.on("boundAction", Header, async req => {
    return {
      code: "TEST",
      name: req.data.text,
      age: req.data.num
    };
  });
};
