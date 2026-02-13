import { randomInt } from "node:crypto";

const MAX_PARTICIPANTS = 2;
const MAX_ROOMS_PER_SESSION = 5;
const CODE_MIN = 100_000;
const CODE_MAX = 999_999;
const MAX_GENERATION_ATTEMPTS = 100;
const ROOM_CODE_PATTERN = /^\d{6}$/;

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

  /** Reverse index: sessionId → set of room codes. O(1) lookup. */
  private sessionToRooms = new Map<string, Set<string>>();

  /** Check if a value looks like a valid 6-digit room code. */
  static isValidCode(code: unknown): code is string {
    return typeof code === "string" && ROOM_CODE_PATTERN.test(code);
  }

  createRoom(sessionId: string): RoomResult<{ code: string }> {
    // Prevent a single session from holding too many rooms
    const currentRooms = this.sessionToRooms.get(sessionId);
    if (currentRooms && currentRooms.size >= MAX_ROOMS_PER_SESSION) {
      return { ok: false, error: "Room limit reached" };
    }

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
    this.addSessionIndex(sessionId, code);
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
    this.addSessionIndex(sessionId, code);
    return { ok: true, data: undefined };
  }

  leaveRoom(code: string, sessionId: string): void {
    const room = this.rooms.get(code);
    if (!room) return;

    room.participants.delete(sessionId);
    this.removeSessionIndex(sessionId, code);

    if (room.participants.size === 0) {
      this.rooms.delete(code);
    }
  }

  /** Remove a session from every room it belongs to. Returns the codes it left. */
  removeFromAll(sessionId: string): string[] {
    const codes = this.sessionToRooms.get(sessionId);
    if (!codes || codes.size === 0) {
      return [];
    }

    const left: string[] = [];
    for (const code of codes) {
      const room = this.rooms.get(code);
      if (!room) continue;

      room.participants.delete(sessionId);
      left.push(code);

      if (room.participants.size === 0) {
        this.rooms.delete(code);
      }
    }

    this.sessionToRooms.delete(sessionId);
    return left;
  }

  /** Return all room codes a session belongs to. O(1) via reverse index. */
  getRoomsBySession(sessionId: string): string[] {
    const codes = this.sessionToRooms.get(sessionId);
    return codes ? [...codes] : [];
  }

  isParticipant(code: string, sessionId: string): boolean {
    const room = this.rooms.get(code);
    return room ? room.participants.has(sessionId) : false;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  /**
   * Remove participants whose sessions no longer exist.
   * Deletes rooms that become empty. Returns number of rooms reaped.
   */
  reapStale(isSessionAlive: (sessionId: string) => boolean): number {
    let reaped = 0;
    for (const [code, room] of this.rooms) {
      for (const sessionId of room.participants) {
        if (!isSessionAlive(sessionId)) {
          room.participants.delete(sessionId);
          this.removeSessionIndex(sessionId, code);
        }
      }
      if (room.participants.size === 0) {
        this.rooms.delete(code);
        reaped++;
      }
    }
    return reaped;
  }

  /** Visible for testing / health checks. */
  get size(): number {
    return this.rooms.size;
  }

  // ── private ────────────────────────────────────────────────

  private addSessionIndex(sessionId: string, code: string): void {
    let codes = this.sessionToRooms.get(sessionId);
    if (!codes) {
      codes = new Set();
      this.sessionToRooms.set(sessionId, codes);
    }
    codes.add(code);
  }

  private removeSessionIndex(sessionId: string, code: string): void {
    const codes = this.sessionToRooms.get(sessionId);
    if (!codes) return;
    codes.delete(code);
    if (codes.size === 0) this.sessionToRooms.delete(sessionId);
  }

  private generateUniqueCode(): string | null {
    for (let i = 0; i < MAX_GENERATION_ATTEMPTS; i++) {
      const code = String(randomInt(CODE_MIN, CODE_MAX + 1));
      if (!this.rooms.has(code)) return code;
    }
    return null;
  }
}
