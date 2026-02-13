import { randomUUID } from "node:crypto";

import type { RoomService } from "./room-service.js";

const MAX_MESSAGE_LENGTH = 1000;
const THROTTLE_WINDOW_MS = 3_000;
const THROTTLE_MAX_MESSAGES = 5;

export interface ChatMessage {
  id: string;
  roomCode: string;
  sessionId: string;
  content: string;
  timestamp: number;
}

export type ChatResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export class ChatService {
  /** sessionId → list of message timestamps within the sliding window */
  private recentMessages = new Map<string, number[]>();

  constructor(private readonly roomService: RoomService) {}

  processMessage(
    roomCode: unknown,
    sessionId: string,
    content: unknown
  ): ChatResult<ChatMessage> {
    // ── validate types ──────────────────────────────────────
    if (typeof roomCode !== "string" || roomCode.length === 0) {
      return { ok: false, error: "Invalid room code" };
    }

    if (typeof content !== "string") {
      return { ok: false, error: "Message content must be a string" };
    }

    const trimmed = content.trim();
    if (trimmed.length === 0) {
      return { ok: false, error: "Message cannot be empty" };
    }

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      return {
        ok: false,
        error: `Message exceeds ${MAX_MESSAGE_LENGTH} characters`,
      };
    }

    // ── membership check ────────────────────────────────────
    if (!this.roomService.isParticipant(roomCode, sessionId)) {
      return { ok: false, error: "Not a participant of this room" };
    }

    // ── throttle ────────────────────────────────────────────
    if (!this.checkThrottle(sessionId)) {
      return { ok: false, error: "Sending messages too fast" };
    }

    // ── build message ───────────────────────────────────────
    const message: ChatMessage = {
      id: randomUUID(),
      roomCode,
      sessionId,
      content: trimmed,
      timestamp: Date.now(),
    };

    return { ok: true, data: message };
  }

  /** Remove throttle state for a session (called on session expiry). */
  clearSession(sessionId: string): void {
    this.recentMessages.delete(sessionId);
  }

  // ── private ────────────────────────────────────────────────

  private checkThrottle(sessionId: string): boolean {
    const now = Date.now();
    const cutoff = now - THROTTLE_WINDOW_MS;

    let timestamps = this.recentMessages.get(sessionId);
    if (!timestamps) {
      timestamps = [];
      this.recentMessages.set(sessionId, timestamps);
    }

    // Drop entries outside the window
    while (timestamps.length > 0 && timestamps[0]! < cutoff) {
      timestamps.shift();
    }

    if (timestamps.length >= THROTTLE_MAX_MESSAGES) {
      return false;
    }

    timestamps.push(now);
    return true;
  }
}
