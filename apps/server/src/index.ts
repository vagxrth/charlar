import { createServer } from "node:http";

import { app } from "./app.js";
import { config } from "./config/env.js";
import { logger } from "./logger.js";
import { initSocket } from "./socket/index.js";

const server = createServer(app);
const io = initSocket(server);

server.listen(config.port, () => {
  logger.info(
    { port: config.port, env: config.nodeEnv },
    "server started"
  );
});

// ── Graceful shutdown ────────────────────────────────────
// Railway sends SIGTERM before killing the container.
// Close the server, disconnect all sockets, then exit.

function shutdown(signal: string) {
  logger.info({ signal }, "shutdown signal received, draining connections");

  // Stop accepting new connections
  server.close(() => {
    logger.info("http server closed");
  });

  // Disconnect all sockets so clients know to reconnect elsewhere
  io.close(() => {
    logger.info("socket.io server closed");
    process.exit(0);
  });

  // Force exit after 10 seconds if draining stalls
  setTimeout(() => {
    logger.warn("forced exit after drain timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ── Unhandled errors ─────────────────────────────────────
// Log and exit on unrecoverable errors so the process manager can restart.

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught exception — exiting");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "unhandled rejection — exiting");
  process.exit(1);
});

export { io, server };
