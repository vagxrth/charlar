import { config } from "../config/env.js";
import { ChatService } from "./chat-service.js";
import { IceConfigService } from "./ice-config-service.js";
import { PresenceService } from "./presence-service.js";
import { RoomService } from "./room-service.js";
import { SessionService } from "./session-service.js";
import { TypingService } from "./typing-service.js";

export const roomService = new RoomService();
export const chatService = new ChatService(roomService);
export const typingService = new TypingService(roomService);

/**
 * When a session's grace period expires without reconnection,
 * evict it from every room and clean up transient state.
 */
export const sessionService = new SessionService(
  config.reconnectTimeoutMs,
  (sessionId) => {
    const codes = roomService.removeFromAll(sessionId);
    chatService.clearSession(sessionId);
    typingService.clearSession(sessionId);
    for (const code of codes) {
      console.log(
        `[session] expired ${sessionId.slice(0, 8)}… — removed from room ${code}`
      );
    }
  }
);

export const presenceService = new PresenceService(roomService, sessionService);

export const iceConfigService = new IceConfigService({
  stunUrls: config.stunUrls,
  turnUrls: config.turnUrls,
  turnUsername: config.turnUsername,
  turnCredential: config.turnCredential,
  turnSecret: config.turnSecret,
  turnCredentialTtl: config.turnCredentialTtl,
});
