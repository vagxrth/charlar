import { iceConfigService, roomService } from "../../services/index.js";
import { ensureCallback, getSessionId, type SocketHandler } from "../types.js";

/**
 * The full ICE config for a call: STUN plus TURN with short-lived
 * credentials. Only sessions that are in a room get it, so TURN credentials
 * go to people setting up a call; the public HTTP endpoint serves STUN only.
 */
export const iceHandler: SocketHandler = (_io, socket) => {
  socket.on("ice:config", (rawCallback: unknown) => {
    const callback = ensureCallback(rawCallback);
    const sessionId = getSessionId(socket);

    if (roomService.getRoomsBySession(sessionId).length === 0) {
      callback({ ok: false, error: "Join a room first" });
      return;
    }

    callback({ ok: true, iceServers: iceConfigService.getIceServers() });
  });
};
