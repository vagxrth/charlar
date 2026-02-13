import { logger } from "../../logger.js";
import { presenceService, roomService } from "../../services/index.js";
import { RoomService } from "../../services/room-service.js";
import { ensureCallback, getSessionId, type SocketHandler } from "../types.js";

// ── Join attempt rate limiting (brute-force prevention) ──
const MAX_FAILED_JOINS = 5;
const FAILED_JOIN_WINDOW_MS = 60_000;
const failedJoinAttempts = new Map<string, number[]>();

function isJoinAllowed(sessionId: string): boolean {
  const now = Date.now();
  const cutoff = now - FAILED_JOIN_WINDOW_MS;

  let timestamps = failedJoinAttempts.get(sessionId);
  if (!timestamps) {
    timestamps = [];
    failedJoinAttempts.set(sessionId, timestamps);
  }

  while (timestamps.length > 0 && timestamps[0]! < cutoff) {
    timestamps.shift();
  }

  return timestamps.length < MAX_FAILED_JOINS;
}

function recordFailedJoin(sessionId: string): void {
  let timestamps = failedJoinAttempts.get(sessionId);
  if (!timestamps) {
    timestamps = [];
    failedJoinAttempts.set(sessionId, timestamps);
  }
  timestamps.push(Date.now());
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - FAILED_JOIN_WINDOW_MS;
  for (const [id, timestamps] of failedJoinAttempts) {
    while (timestamps.length > 0 && timestamps[0]! < cutoff) {
      timestamps.shift();
    }
    if (timestamps.length === 0) failedJoinAttempts.delete(id);
  }
}, 5 * 60_000).unref();

export const roomsHandler: SocketHandler = (io, socket) => {
  socket.on("room:create", (rawCallback: unknown) => {
    const callback = ensureCallback(rawCallback);
    const sessionId = getSessionId(socket);
    const result = roomService.createRoom(sessionId);

    if (!result.ok) {
      callback({ ok: false, error: result.error });
      return;
    }

    const { code } = result.data;
    void socket.join(code);
    logger.info({ session: sessionId.slice(0, 8), room: code }, "room created");
    callback({ ok: true, code, participantCount: 1 });
  });

  socket.on(
    "room:join",
    (code: unknown, rawCallback: unknown) => {
      const callback = ensureCallback(rawCallback);
      const sessionId = getSessionId(socket);

      // Validate room code format
      if (!RoomService.isValidCode(code)) {
        callback({ ok: false, error: "Invalid room code" });
        return;
      }

      // Throttle failed join attempts to prevent brute-force
      if (!isJoinAllowed(sessionId)) {
        callback({ ok: false, error: "Too many attempts, try again later" });
        return;
      }

      const result = roomService.joinRoom(code, sessionId);

      if (!result.ok) {
        recordFailedJoin(sessionId);
        callback({ ok: false, error: result.error });
        return;
      }

      void socket.join(code);

      const presence = presenceService.getRoomPresence(code, sessionId);
      const participantCount = presenceService.getParticipantCount(code);

      socket.to(code).emit("room:peer-joined", { sessionId, participantCount });
      logger.info({ session: sessionId.slice(0, 8), room: code }, "room joined");

      callback({
        ok: true,
        participantCount,
        participants: presence.ok ? presence.data : [],
      });
    }
  );

  socket.on(
    "room:leave",
    (code: unknown, rawCallback: unknown) => {
      const callback = ensureCallback(rawCallback);

      if (!RoomService.isValidCode(code)) {
        callback({ ok: false, error: "Invalid room code" });
        return;
      }

      const sessionId = getSessionId(socket);
      roomService.leaveRoom(code, sessionId);
      void socket.leave(code);

      const participantCount = presenceService.getParticipantCount(code);
      socket.to(code).emit("room:peer-left", { sessionId, participantCount });
      logger.info({ session: sessionId.slice(0, 8), room: code }, "room left");
      callback({ ok: true });
    }
  );
};
