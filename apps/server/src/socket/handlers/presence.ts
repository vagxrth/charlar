import { presenceService } from "../../services/index.js";
import { RoomService } from "../../services/room-service.js";
import { ensureCallback, getSessionId, type SocketHandler } from "../types.js";

export const presenceHandler: SocketHandler = (_io, socket) => {
  socket.on(
    "presence:request",
    (roomCode: unknown, rawCallback: unknown) => {
      const callback = ensureCallback(rawCallback);

      if (!RoomService.isValidCode(roomCode)) {
        callback({ ok: false, error: "Invalid room code" });
        return;
      }

      const sessionId = getSessionId(socket);
      const result = presenceService.getRoomPresence(roomCode, sessionId);

      if (!result.ok) {
        callback({ ok: false, error: result.error });
        return;
      }

      callback({
        ok: true,
        participants: result.data,
        participantCount: result.data.length,
      });
    }
  );
};
