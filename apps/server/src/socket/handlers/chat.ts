import { chatService, typingService } from "../../services/index.js";
import { getSessionId, type SocketHandler } from "../types.js";

export const chatHandler: SocketHandler = (_io, socket) => {
  socket.on(
    "chat:message",
    (
      payload: { roomCode: unknown; content: unknown },
      callback: (res: unknown) => void
    ) => {
      const sessionId = getSessionId(socket);
      const result = chatService.processMessage(
        payload.roomCode,
        sessionId,
        payload.content
      );

      if (!result.ok) {
        callback({ ok: false, error: result.error });
        return;
      }

      const { id, roomCode, content, timestamp } = result.data;

      // Sending a message implicitly stops the typing indicator
      typingService.stopTyping(roomCode, sessionId);

      socket.to(roomCode).emit("chat:message", {
        id,
        sessionId,
        content,
        timestamp,
      });

      callback({ ok: true, id, timestamp });
    }
  );

  // ── typing indicators ───────────────────────────────────

  socket.on(
    "typing:start",
    (roomCode: string, callback: (res: unknown) => void) => {
      const sessionId = getSessionId(socket);
      const result = typingService.startTyping(roomCode, sessionId);

      if (!result.ok) {
        callback({ ok: false, error: result.error });
        return;
      }

      socket.to(roomCode).emit("typing:start", { sessionId });
      callback({ ok: true });
    }
  );

  socket.on(
    "typing:stop",
    (roomCode: string, callback: (res: unknown) => void) => {
      const sessionId = getSessionId(socket);
      const stopped = typingService.stopTyping(roomCode, sessionId);

      if (stopped) {
        socket.to(roomCode).emit("typing:stop", { sessionId });
      }

      callback({ ok: true });
    }
  );
};
