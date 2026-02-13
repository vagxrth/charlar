import type { RoomService } from "./room-service.js";

const AUTO_EXPIRE_MS = 5_000;

export type TypingResult = { ok: true } | { ok: false; error: string };

export class TypingService {
  /** roomCode → Map<sessionId, auto-expire timer> */
  private typing = new Map<
    string,
    Map<string, ReturnType<typeof setTimeout>>
  >();

  private onExpired: ((roomCode: string, sessionId: string) => void) | null =
    null;

  constructor(private readonly roomService: RoomService) {}

  /** Set by the socket layer once the io instance is available. */
  setOnExpired(fn: (roomCode: string, sessionId: string) => void): void {
    this.onExpired = fn;
  }

  startTyping(roomCode: string, sessionId: string): TypingResult {
    if (!this.roomService.isParticipant(roomCode, sessionId)) {
      return { ok: false, error: "Not a participant of this room" };
    }

    let room = this.typing.get(roomCode);
    if (!room) {
      room = new Map();
      this.typing.set(roomCode, room);
    }

    // Reset existing timer if already typing
    const existing = room.get(sessionId);
    if (existing) clearTimeout(existing);

    room.set(
      sessionId,
      setTimeout(() => {
        this.expire(roomCode, sessionId);
      }, AUTO_EXPIRE_MS)
    );

    return { ok: true };
  }

  stopTyping(roomCode: string, sessionId: string): boolean {
    const room = this.typing.get(roomCode);
    if (!room) return false;

    const timer = room.get(sessionId);
    if (!timer) return false;

    clearTimeout(timer);
    room.delete(sessionId);
    if (room.size === 0) this.typing.delete(roomCode);

    return true;
  }

  /** Clear all typing state for a session. Returns room codes where they were typing. */
  clearSession(sessionId: string): string[] {
    const rooms: string[] = [];

    for (const [roomCode, room] of this.typing) {
      const timer = room.get(sessionId);
      if (!timer) continue;

      clearTimeout(timer);
      room.delete(sessionId);
      rooms.push(roomCode);

      if (room.size === 0) this.typing.delete(roomCode);
    }

    return rooms;
  }

  // ── private ────────────────────────────────────────────────

  private expire(roomCode: string, sessionId: string): void {
    const room = this.typing.get(roomCode);
    if (room) {
      room.delete(sessionId);
      if (room.size === 0) this.typing.delete(roomCode);
    }

    this.onExpired?.(roomCode, sessionId);
  }
}
