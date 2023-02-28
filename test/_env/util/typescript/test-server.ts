"use strict";

import express = require("express");
import proxy from "../../../../src";

const app = express();
app.use(
    proxy({
        path: "v2",
        model: "all",
        port: 4004,
    })
);