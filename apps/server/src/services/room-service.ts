import { randomInt } from "node:crypto";

const MAX_PARTICIPANTS = 2;
const CODE_MIN = 100_000;
const CODE_MAX = 999_999;
const MAX_GENERATION_ATTEMPTS = 100;

export interface Room {
  code: string;
  participants: Set<string>; // session IDs
  createdAt: number;
}

export type RoomResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export class RoomService {
  private rooms = new Map<string, Room>();

  createRoom(sessionId: string): RoomResult<{ code: string }> {
    const code = this.generateUniqueCode();
    if (!code) {
      return { ok: false, error: "Failed to generate a unique room code" };
    }

    const room: Room = {
      code,
      participants: new Set([sessionId]),
      createdAt: Date.now(),
    };

    this.rooms.set(code, room);
    return { ok: true, data: { code } };
  }

  joinRoom(code: string, sessionId: string): RoomResult {
    const room = this.rooms.get(code);

    if (!room) {
      return { ok: false, error: "Room not found" };
    }

    if (room.participants.has(sessionId)) {
      return { ok: false, error: "Already in this room" };
    }

    if (room.participants.size >= MAX_PARTICIPANTS) {
      return { ok: false, error: "Room is full" };
    }

    room.participants.add(sessionId);
    return { ok: true, data: undefined };
  }

  leaveRoom(code: string, sessionId: string): void {
    const room = this.rooms.get(code);
    if (!room) return;

    room.participants.delete(sessionId);

    if (room.participants.size === 0) {
      this.rooms.delete(code);
    }
  }

  /** Remove a session from every room it belongs to. Returns the codes it left. */
  removeFromAll(sessionId: string): string[] {
    const left: string[] = [];

    for (const [code, room] of this.rooms) {
      if (!room.participants.has(sessionId)) continue;

      room.participants.delete(sessionId);
      left.push(code);

      if (room.participants.size === 0) {
        this.rooms.delete(code);
      }
    }

    return left;
  }

  /** Return all room codes a session belongs to. */
  getRoomsBySession(sessionId: string): string[] {
    const codes: string[] = [];
    for (const [code, room] of this.rooms) {
      if (room.participants.has(sessionId)) {
        codes.push(code);
      }
    }
    return codes;
  }

  isParticipant(code: string, sessionId: string): boolean {
    const room = this.rooms.get(code);
    return room ? room.participants.has(sessionId) : false;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  /** Visible for testing / health checks. */
  get size(): number {
    return this.rooms.size;
  }

  // ── private ────────────────────────────────────────────────

  private generateUniqueCode(): string | null {
    for (let i = 0; i < MAX_GENERATION_ATTEMPTS; i++) {
      const code = String(randomInt(CODE_MIN, CODE_MAX + 1));
      if (!this.rooms.has(code)) return code;
    }
    return null;
  }
}
