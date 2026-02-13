import { logger } from "../../logger.js";
import { roomService, sessionService } from "../../services/index.js";
import { RoomService } from "../../services/room-service.js";
import { ensureCallback, getSessionId, type SocketHandler } from "../types.js";

interface SignalPayload {
  roomCode: unknown;
  targetSessionId: unknown;
  [key: string]: unknown;
}

const MAX_SDP_LENGTH = 100_000; // SDP is typically 2-10 KB
const MAX_CANDIDATE_LENGTH = 10_000;

/** Verify an SDP payload has the expected shape and bounded size. */
function isValidSdp(sdp: unknown): boolean {
  if (typeof sdp !== "object" || sdp === null || Array.isArray(sdp)) return false;
  const s = sdp as Record<string, unknown>;
  return (
    (s["type"] === "offer" || s["type"] === "answer") &&
    typeof s["sdp"] === "string" &&
    s["sdp"].length > 0 &&
    s["sdp"].length <= MAX_SDP_LENGTH
  );
}

/** Verify an ICE candidate payload has the expected shape. */
function isValidIceCandidate(candidate: unknown): boolean {
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate))
    return false;
  const c = candidate as Record<string, unknown>;
  // candidate field is a string (may be empty for end-of-candidates)
  if ("candidate" in c && typeof c["candidate"] !== "string") return false;
  if (typeof c["candidate"] === "string" && c["candidate"].length > MAX_CANDIDATE_LENGTH)
    return false;
  return true;
}

/**
 * Validate that both sender and target are participants of the room,
 * and that the target is currently connected (has a live socket).
 * Returns the target's socketId on success, or an error string.
 */
function validateRelay(
  senderSessionId: string,
  payload: SignalPayload
): { ok: true; targetSocketId: string } | { ok: false; error: string } {
  const { roomCode, targetSessionId } = payload;

  if (!RoomService.isValidCode(roomCode)) {
    return { ok: false, error: "Invalid room code" };
  }

  if (typeof targetSessionId !== "string" || targetSessionId.length === 0) {
    return { ok: false, error: "Invalid target session" };
  }

  if (senderSessionId === targetSessionId) {
    return { ok: false, error: "Cannot signal yourself" };
  }

  if (!roomService.isParticipant(roomCode, senderSessionId)) {
    return { ok: false, error: "Not a participant of this room" };
  }

  if (!roomService.isParticipant(roomCode, targetSessionId)) {
    return { ok: false, error: "Target is not in this room" };
  }

  const targetSession = sessionService.getById(targetSessionId);
  if (!targetSession?.socketId) {
    return { ok: false, error: "Target is not connected" };
  }

  return { ok: true, targetSocketId: targetSession.socketId };
}

export const signalingHandler: SocketHandler = (io, socket) => {
  socket.on(
    "signal:offer",
    (payload: SignalPayload, rawCallback: unknown) => {
      const callback = ensureCallback(rawCallback);

      if (!isValidSdp(payload?.sdp)) {
        callback({ ok: false, error: "Invalid SDP payload" });
        return;
      }

      const sessionId = getSessionId(socket);
      const result = validateRelay(sessionId, payload);

      if (!result.ok) {
        callback(result);
        return;
      }

      io.to(result.targetSocketId).emit("signal:offer", {
        sessionId,
        sdp: payload.sdp,
      });

      logger.debug(
        { from: sessionId.slice(0, 8), to: (payload.targetSessionId as string).slice(0, 8), room: payload.roomCode as string },
        "signal:offer relayed"
      );
      callback({ ok: true });
    }
  );

  socket.on(
    "signal:answer",
    (payload: SignalPayload, rawCallback: unknown) => {
      const callback = ensureCallback(rawCallback);

      if (!isValidSdp(payload?.sdp)) {
        callback({ ok: false, error: "Invalid SDP payload" });
        return;
      }

      const sessionId = getSessionId(socket);
      const result = validateRelay(sessionId, payload);

      if (!result.ok) {
        callback(result);
        return;
      }

      io.to(result.targetSocketId).emit("signal:answer", {
        sessionId,
        sdp: payload.sdp,
      });

      logger.debug(
        { from: sessionId.slice(0, 8), to: (payload.targetSessionId as string).slice(0, 8), room: payload.roomCode as string },
        "signal:answer relayed"
      );
      callback({ ok: true });
    }
  );

  socket.on(
    "signal:ice-candidate",
    (payload: SignalPayload, rawCallback: unknown) => {
      const callback = ensureCallback(rawCallback);

      if (!isValidIceCandidate(payload?.candidate)) {
        callback({ ok: false, error: "Invalid ICE candidate" });
        return;
      }

      const sessionId = getSessionId(socket);
      const result = validateRelay(sessionId, payload);

      if (!result.ok) {
        callback(result);
        return;
      }

      io.volatile.to(result.targetSocketId).emit("signal:ice-candidate", {
        sessionId,
        candidate: payload.candidate,
      });

      callback({ ok: true });
    }
  );
};
