import { presenceService, roomService } from "../../services/index.js";
import { getSessionId, type SocketHandler } from "../types.js";

export const roomsHandler: SocketHandler = (io, socket) => {
  socket.on("room:create", (callback: (res: unknown) => void) => {
    const sessionId = getSessionId(socket);
    const result = roomService.createRoom(sessionId);

    if (!result.ok) {
      callback({ ok: false, error: result.error });
      return;
    }

    const { code } = result.data;
    void socket.join(code);
    console.log(`[rooms] ${sessionId.slice(0, 8)}… created room ${code}`);
    callback({ ok: true, code, participantCount: 1 });
  });

  socket.on(
    "room:join",
    (code: string, callback: (res: unknown) => void) => {
      const sessionId = getSessionId(socket);
      const result = roomService.joinRoom(code, sessionId);

      if (!result.ok) {
        callback({ ok: false, error: result.error });
        return;
      }

      void socket.join(code);

      const presence = presenceService.getRoomPresence(code, sessionId);
      const participantCount = presenceService.getParticipantCount(code);

      socket.to(code).emit("room:peer-joined", { sessionId, participantCount });
      console.log(`[rooms] ${sessionId.slice(0, 8)}… joined room ${code}`);

      callback({
        ok: true,
        participantCount,
        participants: presence.ok ? presence.data : [],
      });
    }
  );

  socket.on(
    "room:leave",
    (code: string, callback: (res: unknown) => void) => {
      const sessionId = getSessionId(socket);
      roomService.leaveRoom(code, sessionId);
      void socket.leave(code);

      const participantCount = presenceService.getParticipantCount(code);
      socket.to(code).emit("room:peer-left", { sessionId, participantCount });
      console.log(`[rooms] ${sessionId.slice(0, 8)}… left room ${code}`);
      callback({ ok: true });
    }
  );
};
