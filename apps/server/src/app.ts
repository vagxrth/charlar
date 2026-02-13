import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";

import { config } from "./config/env.js";
import { httpLogger } from "./logger.js";
import { iceConfigService } from "./services/index.js";

const app: Express = express();

app.use(helmet());
app.use(httpLogger);
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/ice-config", (_req, res) => {
  const iceServers = iceConfigService.getIceServers();
  res.json({ iceServers });
});

export { app };
