"use strict";

import app from "express";
import proxy from "./lib";

app.use(
    proxy({
        path: "v2",
        model: "all",
        port: 4004,
    })
);