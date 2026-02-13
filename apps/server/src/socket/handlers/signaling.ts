import { roomService, sessionService } from "../../services/index.js";
import { getSessionId, type SocketHandler } from "../types.js";

interface SignalPayload {
  roomCode: unknown;
  targetSessionId: unknown;
  [key: string]: unknown;
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

  if (typeof roomCode !== "string" || roomCode.length === 0) {
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
    (payload: SignalPayload, callback: (res: unknown) => void) => {
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

      console.log(
        `[signal] offer ${sessionId.slice(0, 8)}… → ${(payload.targetSessionId as string).slice(0, 8)}… in ${payload.roomCode as string}`
      );
      callback({ ok: true });
    }
  );

  socket.on(
    "signal:answer",
    (payload: SignalPayload, callback: (res: unknown) => void) => {
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

      console.log(
        `[signal] answer ${sessionId.slice(0, 8)}… → ${(payload.targetSessionId as string).slice(0, 8)}… in ${payload.roomCode as string}`
      );
      callback({ ok: true });
    }
  );

  socket.on(
    "signal:ice-candidate",
    (payload: SignalPayload, callback: (res: unknown) => void) => {
      const sessionId = getSessionId(socket);
      const result = validateRelay(sessionId, payload);

      if (!result.ok) {
        callback(result);
        return;
      }

      io.to(result.targetSocketId).emit("signal:ice-candidate", {
        sessionId,
        candidate: payload.candidate,
      });

      callback({ ok: true });
    }
  );
};
