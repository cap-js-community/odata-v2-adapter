"use strict";

const cds = require("@sap/cds");

module.exports = (srv) => {
  const { Header, HeaderStream, Book, User } = srv.entities("test.MainService");

  /* Bound Action */

  srv.on("boundAction", Header, async (req) => {
    return {
      code: "TEST",
      name: req.data.text,
      age: req.data.num,
    };
  });

  srv.on("boundMassAction", Header, async (req) => {
    return req.data.ids.map((id, index) => {
      return {
        code: id,
        name: id,
        age: index,
      };
    });
  });

  srv.on("boundActionInline", Header, async (req) => {
    return {
      code: "TEST",
      name: req.data.text,
      age: req.data.num,
    };
  });

  srv.on("boundMassActionInline", Header, async (req) => {
    return req.data.ids.map((id, index) => {
      return {
        code: id,
        name: id,
        age: index,
      };
    });
  });

  srv.on("boundActionNoReturn", Header, async (req) => {});

  srv.on("boundActionPrimitive", Header, async (req) => {
    return req.data.num;
  });

  srv.on("boundActionPrimitiveString", Header, async (req) => {
    return req.data.text;
  });

  srv.on("boundActionPrimitiveLargeString", Header, async (req) => {
    return req.data.text;
  });

  srv.on("boundMassActionPrimitive", Header, async (req) => {
    return [req.data.text1, req.data.text2];
  });

  srv.on("boundActionEntity", Header, async (req) => {
    return {
      name: "TEST",
      description: req.data.text,
      stock: req.data.num,
    };
  });

  srv.on("boundMassActionEntity", Header, async (req) => {
    return req.data.ids.map((id, index) => {
      return {
        name: id,
        description: id,
        stock: index,
      };
    });
  });

  srv.on("boundErrorAction", async (req) => {
    const error = new Error("An error occurred");
    error.code = "ERR01";
    switch (req.data.text) {
      case "default":
      default:
        error.target = "text";
        break;
      case "parameter":
        error.target = "in/text";
        break;
    }
    error.message = "An error occurred";
    error.severity = 4;
    error["@Common.numericSeverity"] = 4;
    error["@Core.ContentID"] = "1";
    req.error(error);
  });

  srv.on("order", Book, async (req) => {
    return {
      author: req.params[0].author,
      genre_ID: req.params[0].genre_ID,
      stock: req.data.number,
    };
  });

  srv.on("order2", Book, async (req) => {
    return {
      author: req.params[0].author + "|" + req.data.author,
      genre_ID: req.params[0].genre_ID,
      stock: req.data.number,
    };
  });

  /* Bound Function */

  srv.on("boundFunction", Header, async (req) => {
    return {
      code: "TEST",
      name: req.data.text,
      age: req.data.num,
    };
  });

  srv.on("boundMassFunction", Header, async (req) => {
    return req.data.ids.map((id, index) => {
      return {
        code: id,
        name: id,
        age: index,
      };
    });
  });

  srv.on("boundFunctionInline", Header, async (req) => {
    return {
      code: "TEST",
      name: req.data.text,
      age: req.data.num,
    };
  });

  srv.on("boundMassFunctionInline", Header, async (req) => {
    return req.data.ids.map((id, index) => {
      return {
        code: id,
        name: id,
        age: index,
      };
    });
  });

  srv.on("boundFunctionPrimitive", Header, async (req) => {
    return req.data.num;
  });

  srv.on("boundFunctionPrimitiveString", Header, async (req) => {
    return req.data.text;
  });

  srv.on("boundFunctionPrimitiveLargeString", Header, async (req) => {
    return req.data.text;
  });

  srv.on("boundMassFunctionPrimitive", Header, async (req) => {
    return [req.data.text1, req.data.text2];
  });

  srv.on("boundFunctionEntity", Header, async (req) => {
    return {
      name: "TEST",
      description: req.data.text,
      stock: req.data.num,
    };
  });

  srv.on("boundMassFunctionEntity", Header, async (req) => {
    return req.data.ids.map((id, index) => {
      return {
        name: id,
        description: id,
        stock: index,
      };
    });
  });

  srv.on("boundErrorFunction", Header, async (req) => {
    const error = new Error("An error occurred");
    error.code = "ERR01";
    error.target = `Header(ID=${req.params[0]},IsActiveEntity=false)/name`;
    error["@Common.additionalTargets"] = [`Header(ID=${req.params[0]},IsActiveEntity=false)/description`];
    error.message = "An error occurred";
    error.severity = 4;
    error["@Common.numericSeverity"] = 4;
    error["@Core.ContentID"] = "1";
    error.details = [
      {
        code: "ERR02-transition",
        target: "Items(ID=2b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/description",
        ["@Common.additionalTargets"]: ["Items(ID=2b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/name"],
        message: "Error details",
        "@Common.numericSeverity": 4,
        "@Core.ContentID": "1",
      },
    ];
    req.error(error);
  });

  srv.on("boundWarningFunction", Header, async (req) => {
    const info1 = new Error("This is a warning");
    info1.code = "WARN01";
    info1.target = `Header(ID=${req.params[0]},IsActiveEntity=false)/name`;
    info1["@Common.additionalTargets"] = [`Header(ID=${req.params[0]},IsActiveEntity=false)/description`];
    info1.message = "An Warning occurred";
    info1.numericSeverity = 3;
    info1["@Core.ContentID"] = "1";
    req.info(info1);

    const info2 = new Error("This is another warning");
    info2.code = "WARN02";
    info2.target = "Items(ID=2b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/description";
    info2["@Common.additionalTargets"] = ["Items(ID=2b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/name"];
    info2.message = "Another Warning occurred";
    info2.numericSeverity = 3;
    info2["@Core.ContentID"] = "2";
    req.info(info2);

    return {
      name: "Test",
      code: "TEST",
      age: 1,
    };
  });

  /* Unbound Action */

  srv.on("unboundAction", async (req) => {
    return [
      {
        code: "TEST",
        name: req.data.text,
        age: req.data.num,
      },
    ];
  });

  srv.on("unboundMassAction", async (req) => {
    return req.data.ids.map((id, index) => {
      return {
        code: id,
        name: id,
        age: index,
      };
    });
  });

  srv.on("unboundActionInline", async (req) => {
    return [
      {
        code: "TEST",
        name: req.data.text,
        age: req.data.num,
      },
    ];
  });

  srv.on("unboundMassActionInline", async (req) => {
    return req.data.ids.map((id, index) => {
      return {
        code: id,
        name: id,
        age: index,
      };
    });
  });

  srv.on("unboundActionNoReturn", async (req) => {});

  srv.on("unboundActionPrimitive", async (req) => {
    return req.data.num;
  });

  srv.on("unboundActionPrimitiveString", async (req) => {
    return req.data.text;
  });

  srv.on("unboundActionPrimitiveLargeString", async (req) => {
    return req.data.text;
  });

  srv.on("unboundMassActionPrimitive", async (req) => {
    return [req.data.text1, req.data.text2];
  });

  srv.on("unboundActionEntity", async (req) => {
    return {
      name: "TEST",
      description: req.data.text,
      stock: req.data.num,
    };
  });

  srv.on("unboundMassActionEntity", async (req) => {
    return req.data.ids.map((id, index) => {
      return {
        name: id,
        description: id,
        stock: index,
      };
    });
  });

  srv.on("unboundActionMaxLength", async (req) => {
    return req.data.text;
  });

  srv.on("unbound.Action", async (req) => {
    return [
      {
        code: "TEST",
        name: req.data.text,
        age: req.data.num,
      },
    ];
  });

  srv.on("unboundErrorAction", async (req) => {
    const error = new Error("An error occurred");
    error.code = "ERR01";
    switch (req.data.text) {
      case "default":
      default:
        error.target = "name";
        break;
      case "unchecked":
        error.target = "_xXx123";
        break;
      case "relative":
        error.target = "Header(ID=1b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/name";
        break;
      case "guid":
        error.target = "Header(ID=guid'1b750773-bb1b-4565-8a33-79c99440e4e8',IsActiveEntity=false)/name";
        break;
      case "absolute":
        error.target = "/Header(ID=1b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/name";
        break;
      case "parameter":
        error.target = "in/text";
        break;
      case "transient":
        error.target = "/#TRANSIENT#";
        break;
      case "transientpath":
        error.target = "/#TRANSIENT#/Header(ID=1b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/name";
        break;
      case "invalid":
        error.target = "Header2(ID=1b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/name2";
        break;
    }
    error.message = "An error occurred";
    error.severity = 4;
    error["@Common.numericSeverity"] = 4;
    error["@Core.ContentID"] = "1";
    req.error(error);
  });

  /* Unbound Function */

  srv.on("unboundFunction", async (req) => {
    return {
      code: "TEST",
      name: req.data.text,
      age: req.data.num,
    };
  });

  srv.on("unboundMassFunction", async (req) => {
    // Unwrap collection
    const ids = req.data.ids || JSON.parse(req._.req.query["@idsCol"]).map((id) => id.replace(/^["](.*)["]$/, "$1"));
    return ids.map((id, index) => {
      return {
        code: id,
        name: id,
        age: index,
      };
    });
  });

  srv.on("unboundFunctionInline", async (req) => {
    return {
      code: "TEST",
      name: req.data.text,
      age: req.data.num,
    };
  });

  srv.on("unboundMassFunctionInline", async (req) => {
    // Unwrap collection
    const ids = req.data.ids || JSON.parse(req._.req.query["@idsCol"]).map((id) => id.replace(/^["](.*)["]$/, "$1"));
    return ids.map((id, index) => {
      return {
        code: id,
        name: id,
        age: index,
      };
    });
  });

  srv.on("unboundFunctionPrimitive", async (req) => {
    return req.data.num;
  });

  srv.on("unboundFunctionPrimitiveString", async (req) => {
    return req.data.text;
  });

  srv.on("unboundFunctionPrimitiveLargeString", async (req) => {
    return req.data.text;
  });

  srv.on("unboundMassFunctionPrimitive", async (req) => {
    return [req.data.text1, req.data.text2];
  });

  srv.on("unboundFunctionEntity", async (req) => {
    return {
      name: "TEST",
      description: req.data.text,
      stock: req.data.num,
    };
  });

  srv.on("unboundMassFunctionEntity", async (req) => {
    const ids = req.data.ids || JSON.parse(req._.req.query["@idsCol"]).map((id) => id.replace(/^["](.*)["]$/, "$1"));
    return ids.map((id, index) => {
      return {
        name: id,
        description: id,
        stock: index,
      };
    });
  });

  srv.on("unboundDecimalFunction", async (req) => {
    return 12345.6789;
  });

  srv.on("unboundDecimalsFunction", async (req) => {
    return [12345.6789, 12345.6789];
  });

  srv.on("unboundDecimalResultFunction", async (req) => {
    return {
      name: "Test",
      decimal: 12345.6789,
      array: [
        {
          name: "Test",
          decimal: 12345.6789,
        },
      ],
    };
  });

  srv.on("unboundErrorFunction", async (req) => {
    const error = new Error("An error occurred");
    error.code = "ERR01";
    error.target = "Header(ID=1b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/name";
    error["@Common.additionalTargets"] = [
      "Header(ID=1b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/description",
    ];
    error.message = "An error occurred";
    error.severity = 4;
    error["@Common.numericSeverity"] = 4;
    error["@Core.ContentID"] = "1";
    error.details = [
      {
        code: "ERR02-transition",
        target:
          "Header(ID=1b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/Items(ID=2b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/description",
        ["@Common.additionalTargets"]: [
          "Header(ID=1b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/Items(ID=2b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/name",
        ],
        message: "Error details",
        "@Common.numericSeverity": 4,
      },
    ];
    req.error(error);
  });

  srv.on("unboundWarningFunction", async (req) => {
    const info1 = new Error("This is a warning");
    info1.code = "WARN01";
    info1.target = "Header(ID=1b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/name";
    info1["@Common.additionalTargets"] = [
      "Header(ID=1b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/description",
    ];
    info1.message = "An Warning occurred";
    info1.numericSeverity = 3;
    info1["@Core.ContentID"] = "1";
    req.info(info1);

    const info2 = new Error("This is another warning");
    info2.code = "WARN02";
    info2.target =
      "Header(ID=1b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/Items(ID=2b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/description";
    info2["@Common.additionalTargets"] = [
      "Header(ID=1b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/Items(ID=2b750773-bb1b-4565-8a33-79c99440e4e8,IsActiveEntity=false)/name",
    ];
    info2.message = "Another Warning occurred";
    info2.numericSeverity = 3;
    info2["@Core.ContentID"] = "2";
    req.info(info2);

    return {
      name: "Test",
      code: "TEST",
      age: 1,
    };
  });

  srv.on("unboundEscapedWarningFunction", async (req) => {
    const warn = new Error("óáé");
    warn.code = "WARN01";
    warn.message = "Użytkownik";
    warn.numericSeverity = 3;
    req.info(warn);
  });

  srv.on("unboundNavigationFunction", async (req) => {
    return cds.run(SELECT.from("test.MainService.Header").where({ ID: req.data.text }));
  });

  srv.on("unboundNavigationsFunction", async (req) => {
    return cds.run(SELECT.from("test.MainService.Header"));
  });

  srv.on("unbound.Function", async (req) => {
    return {
      code: "TEST",
      name: req.data.text,
      age: req.data.num,
    };
  });

  srv.on("calcDecimal", async (req) => {
    return (req.data.value * req.data.percentage) / 100.0;
  });

  srv.on("CREATE", HeaderStream, async (req, next) => {
    if (req.data.filename && req.data.filename.includes("error")) {
      req.error(400, "Filename contains error");
      return;
    }
    await next();
  });

  srv.on("Pay", User, async () => {});
};
