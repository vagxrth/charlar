import cors from "cors";
import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import { config } from "./config/env.js";
import { httpLogger } from "./logger.js";
import { iceConfigService, roomService, sessionService } from "./services/index.js";

const app: Express = express();

// Trust first proxy (Railway / load balancer) so req.ip is the real client IP
app.set("trust proxy", 1);

app.use(helmet());
app.use(httpLogger);
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// Rate limit API endpoints — 30 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    rooms: roomService.size,
    sessions: sessionService.size,
  });
});

app.get("/api/ice-config", apiLimiter, (_req, res) => {
  const iceServers = iceConfigService.getIceServers();
  res.json({ iceServers });
});

export { app };
