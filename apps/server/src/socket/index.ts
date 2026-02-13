import type { Server as HttpServer } from "node:http";

import { Server, type Socket } from "socket.io";

import { config } from "../config/env.js";
import {
  presenceService,
  roomService,
  sessionService,
  typingService,
} from "../services/index.js";
import { chatHandler } from "./handlers/chat.js";
import { presenceHandler } from "./handlers/presence.js";
import { roomsHandler } from "./handlers/rooms.js";
import { signalingHandler } from "./handlers/signaling.js";
import type { SocketHandler } from "./types.js";

const handlers: SocketHandler[] = [
  roomsHandler,
  chatHandler,
  presenceHandler,
  signalingHandler,
];

/**
 * Resolve or create a session for the connecting socket.
 *
 * If the client sends a previous sessionId in handshake auth and
 * that session is still within its grace period, reclaim it and
 * rejoin all Socket.IO rooms. Otherwise create a fresh session.
 */
function resolveSession(
  socket: Socket
): { sessionId: string; reconnected: boolean } {
  const previousId = socket.handshake.auth?.sessionId as string | undefined;

  if (previousId) {
    const session = sessionService.reclaim(previousId, socket.id);
    if (session) {
      return { sessionId: session.id, reconnected: true };
    }
  }

  const session = sessionService.create(socket.id);
  return { sessionId: session.id, reconnected: false };
}

export function initSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin,
    },
  });

  // Wire typing auto-expire broadcasts to the io instance
  typingService.setOnExpired((roomCode, sessionId) => {
    io.to(roomCode).emit("typing:stop", { sessionId });
  });

  io.on("connection", (socket) => {
    const { sessionId, reconnected } = resolveSession(socket);
    socket.data.sessionId = sessionId;

    const tag = sessionId.slice(0, 8);

    if (reconnected) {
      // Rejoin Socket.IO rooms and notify peers
      const codes = roomService.getRoomsBySession(sessionId);
      for (const code of codes) {
        void socket.join(code);
        const participantCount = presenceService.getParticipantCount(code);
        socket.to(code).emit("room:peer-reconnected", {
          sessionId,
          participantCount,
        });
      }
      console.log(
        `[socket] reconnected: ${tag}… (${codes.length} room${codes.length !== 1 ? "s" : ""} restored)`
      );
    } else {
      console.log(`[socket] connected: ${tag}…`);
    }

    // Send session ID to client so it can use it for reconnection
    socket.emit("session:created", { sessionId });

    // Register domain handlers
    for (const handler of handlers) {
      handler(io, socket);
    }

    socket.on("disconnect", (reason) => {
      // Clear typing state and broadcast stop for each room
      const typingRooms = typingService.clearSession(sessionId);
      for (const code of typingRooms) {
        socket.to(code).emit("typing:stop", { sessionId });
      }

      const session = sessionService.handleDisconnect(socket.id);
      if (session) {
        const codes = roomService.getRoomsBySession(session.id);
        for (const code of codes) {
          const participantCount = presenceService.getParticipantCount(code);
          socket.to(code).emit("room:peer-disconnected", {
            sessionId: session.id,
            participantCount,
          });
        }
        console.log(
          `[socket] disconnected: ${tag}… (${reason}) — grace period started`
        );
      } else {
        console.log(`[socket] disconnected: ${socket.id} (${reason})`);
      }
    });
  });

  return io;
}
