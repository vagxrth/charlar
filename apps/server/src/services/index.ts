import { config } from "../config/env.js";
import { logger } from "../logger.js";
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
 * Deferred notification callback — set by the socket layer once `io` exists.
 * Called after cleanup so the socket layer can emit `room:peer-left` events.
 */
let notifySessionExpired: ((sessionId: string, nickname: string | null, leftCodes: string[]) => void) | null = null;

export function setSessionExpiryNotifier(
  fn: (sessionId: string, nickname: string | null, leftCodes: string[]) => void
): void {
  notifySessionExpired = fn;
}

/**
 * When a session's grace period expires without reconnection,
 * evict it from every room and clean up transient state.
 */
export const sessionService = new SessionService(
  config.reconnectTimeoutMs,
  (sessionId, nickname) => {
    const codes = roomService.removeFromAll(sessionId);
    chatService.clearSession(sessionId);
    typingService.clearSession(sessionId);

    if (codes.length > 0) {
      logger.info(
        { session: sessionId.slice(0, 8), rooms: codes },
        "session expired, removed from rooms"
      );
    }

    notifySessionExpired?.(sessionId, nickname, codes);
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
