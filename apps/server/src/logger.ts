import pino from "pino";
import { pinoHttp } from "pino-http";
import { config } from "./config/env.js";

export const logger = pino({ level: config.logLevel });

export const httpLogger = pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url === "/health",
  },
});
