import { chatService, typingService } from "../../services/index.js";
import { RoomService } from "../../services/room-service.js";
import { ensureCallback, getSessionId, type SocketHandler } from "../types.js";

export const chatHandler: SocketHandler = (_io, socket) => {
  socket.on(
    "chat:message",
    (
      payload: { roomCode: unknown; content: unknown },
      rawCallback: unknown
    ) => {
      const callback = ensureCallback(rawCallback);
      const sessionId = getSessionId(socket);
      const result = chatService.processMessage(
        payload?.roomCode,
        sessionId,
        payload?.content
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
    (roomCode: unknown, rawCallback: unknown) => {
      const callback = ensureCallback(rawCallback);

      if (!RoomService.isValidCode(roomCode)) {
        callback({ ok: false, error: "Invalid room code" });
        return;
      }

      const sessionId = getSessionId(socket);
      const result = typingService.startTyping(roomCode, sessionId);

      if (!result.ok) {
        callback({ ok: false, error: result.error });
        return;
      }

      socket.volatile.to(roomCode).emit("typing:start", { sessionId });
      callback({ ok: true });
    }
  );

  socket.on(
    "typing:stop",
    (roomCode: unknown, rawCallback: unknown) => {
      const callback = ensureCallback(rawCallback);

      if (!RoomService.isValidCode(roomCode)) {
        callback({ ok: false, error: "Invalid room code" });
        return;
      }

      const sessionId = getSessionId(socket);
      const stopped = typingService.stopTyping(roomCode, sessionId);

      if (stopped) {
        socket.volatile.to(roomCode).emit("typing:stop", { sessionId });
      }

      callback({ ok: true });
    }
  );
};
