import { logger } from "../../logger.js";
import { presenceService, roomService, sessionService } from "../../services/index.js";
import { RoomService } from "../../services/room-service.js";
import { validateAndNormalizeNickname } from "../../services/session-service.js";
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

function resolveNickname(raw: unknown): string {
  const result = validateAndNormalizeNickname(raw);
  return result.ok ? result.nickname : result.fallback;
}

function deduplicateNickname(roomCode: string, nickname: string): string {
  const room = roomService.getRoom(roomCode);
  if (!room) return nickname;

  const existing = new Set<string>();
  for (const sid of room.participants) {
    const s = sessionService.getById(sid);
    if (s?.nickname) existing.add(s.nickname);
  }

  if (!existing.has(nickname)) return nickname;

  let suffix = 2;
  while (existing.has(`${nickname}${suffix}`)) suffix++;
  return `${nickname}${suffix}`;
}

export const roomsHandler: SocketHandler = (io, socket) => {
  socket.on("room:create", (rawNickname: unknown, rawCallback: unknown) => {
    // Support old signature without nickname: (callback)
    if (typeof rawNickname === "function") {
      rawCallback = rawNickname;
      rawNickname = undefined;
    }
    const callback = ensureCallback(rawCallback);
    const sessionId = getSessionId(socket);
    const result = roomService.createRoom(sessionId);

    if (!result.ok) {
      callback({ ok: false, error: result.error });
      return;
    }

    const nickname = resolveNickname(rawNickname);
    sessionService.setNickname(sessionId, nickname);

    const { code } = result.data;
    void socket.join(code);
    logger.info({ session: sessionId.slice(0, 8), room: code, nickname }, "room created");
    callback({ ok: true, code, participantCount: 1, nickname });
  });

  socket.on(
    "room:join",
    (code: unknown, rawNickname: unknown, rawCallback: unknown) => {
      // Support old signature without nickname: (code, callback)
      if (typeof rawNickname === "function") {
        rawCallback = rawNickname;
        rawNickname = undefined;
      }
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

      const nickname = deduplicateNickname(code, resolveNickname(rawNickname));
      sessionService.setNickname(sessionId, nickname);

      void socket.join(code);

      const presence = presenceService.getRoomPresence(code, sessionId);
      const participantCount = presenceService.getParticipantCount(code);

      socket.to(code).emit("room:peer-joined", { sessionId, nickname, participantCount });
      logger.info({ session: sessionId.slice(0, 8), room: code, nickname }, "room joined");

      callback({
        ok: true,
        nickname,
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
      const nickname = sessionService.getById(sessionId)?.nickname ?? null;
      roomService.leaveRoom(code, sessionId);
      void socket.leave(code);

      const participantCount = presenceService.getParticipantCount(code);
      socket.to(code).emit("room:peer-left", { sessionId, nickname, participantCount });
      logger.info({ session: sessionId.slice(0, 8), room: code, nickname }, "room left");
      callback({ ok: true });
    }
  );
};
