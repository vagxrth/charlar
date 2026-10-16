import { createServer, type Server as HttpServer } from "node:http";

import type { Server as IoServer } from "socket.io";

import { app } from "./app.js";
import { initSocket } from "./socket/index.js";

/**
 * Build the HTTP and Socket.IO servers without listening, so the entry point
 * picks the configured port and tests can pick a free one.
 */
export function createAppServer(): { server: HttpServer; io: IoServer } {
  const server = createServer(app);
  const io = initSocket(server);
  return { server, io };
}
