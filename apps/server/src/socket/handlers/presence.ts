import { presenceService } from "../../services/index.js";
import { getSessionId, type SocketHandler } from "../types.js";

export const presenceHandler: SocketHandler = (_io, socket) => {
  socket.on(
    "presence:request",
    (roomCode: string, callback: (res: unknown) => void) => {
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
