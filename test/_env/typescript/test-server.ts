"use strict";

import express = require("express");
import odataV2 from "../../../src";

const app = express();
app.use(
  odataV2({
    model: "all",
    port: 4004,
  }),
);
