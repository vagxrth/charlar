import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export interface Session {
  id: string;
  /**
   * Secret proof of ownership, sent only to the session's own client. The
   * session ID itself is shared with peers, so it cannot prove anything.
   */
  resumeToken: string;
  socketId: string | null;
  disconnectedAt: number | null;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
  nickname: string | null;
}

// ── Nickname validation ──────────────────────────────────

const NICKNAME_PATTERN = /^[a-zA-Z0-9 _-]+$/;
const MIN_LENGTH = 2;
const MAX_LENGTH = 20;

function generateGuestName(): string {
  const hex = randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
  return `Guest-${hex}`;
}

export function validateAndNormalizeNickname(
  raw: unknown
): { ok: true; nickname: string } | { ok: false; fallback: string } {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { ok: false, fallback: generateGuestName() };
  }

  const trimmed = raw.trim();
  if (
    trimmed.length < MIN_LENGTH ||
    trimmed.length > MAX_LENGTH ||
    !NICKNAME_PATTERN.test(trimmed)
  ) {
    return { ok: false, fallback: generateGuestName() };
  }

  return { ok: true, nickname: trimmed };
}

export class SessionService {
  private sessions = new Map<string, Session>();
  private socketToSession = new Map<string, string>();

  constructor(
    private readonly reconnectTimeoutMs: number,
    private readonly onSessionExpired: (sessionId: string, nickname: string | null) => void
  ) {}

  /** Create a fresh session bound to a socket. */
  create(socketId: string): Session {
    const session: Session = {
      id: randomUUID(),
      resumeToken: randomBytes(32).toString("base64url"),
      socketId,
      disconnectedAt: null,
      cleanupTimer: null,
      nickname: null,
    };

    this.sessions.set(session.id, session);
    this.socketToSession.set(socketId, session.id);
    return session;
  }

  /**
   * Return the session if `resumeToken` proves ownership of it, else null.
   * Compared in constant time so the token can't be guessed byte by byte.
   */
  verify(sessionId: string, resumeToken: string): Session | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const expected = Buffer.from(session.resumeToken);
    const given = Buffer.from(resumeToken);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      return null;
    }
    return session;
  }

  /**
   * Rebind an existing session to a new socket, ending its grace period.
   * Callers must check ownership with `verify` first.
   */
  reclaim(sessionId: string, newSocketId: string): Session | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Clear grace-period timer
    if (session.cleanupTimer) {
      clearTimeout(session.cleanupTimer);
      session.cleanupTimer = null;
    }

    // Unbind old socket mapping if it still exists
    if (session.socketId) {
      this.socketToSession.delete(session.socketId);
    }

    // Bind to new socket
    session.socketId = newSocketId;
    session.disconnectedAt = null;
    this.socketToSession.set(newSocketId, session.id);

    return session;
  }

  /**
   * Called when a socket disconnects. Starts the grace period.
   * The session stays alive until the timer fires.
   */
  handleDisconnect(socketId: string): Session | null {
    const sessionId = this.socketToSession.get(socketId);
    if (!sessionId) return null;

    const session = this.sessions.get(sessionId);
    if (!session) return null;

    this.socketToSession.delete(socketId);
    session.socketId = null;
    session.disconnectedAt = Date.now();

    const capturedNickname = session.nickname;
    session.cleanupTimer = setTimeout(() => {
      this.destroy(session.id);
      this.onSessionExpired(session.id, capturedNickname);
    }, this.reconnectTimeoutMs);

    return session;
  }

  getBySocketId(socketId: string): Session | null {
    const sessionId = this.socketToSession.get(socketId);
    if (!sessionId) return null;
    return this.sessions.get(sessionId) ?? null;
  }

  getById(sessionId: string): Session | null {
    return this.sessions.get(sessionId) ?? null;
  }

  setNickname(sessionId: string, nickname: string): void {
    const session = this.sessions.get(sessionId);
    if (session) session.nickname = nickname;
  }

  get size(): number {
    return this.sessions.size;
  }

  // ── private ────────────────────────────────────────────────

  private destroy(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.cleanupTimer) {
      clearTimeout(session.cleanupTimer);
    }
    if (session.socketId) {
      this.socketToSession.delete(session.socketId);
    }

    this.sessions.delete(sessionId);
  }
}
