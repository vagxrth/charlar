import { randomUUID } from "node:crypto";

export interface Session {
  id: string;
  socketId: string | null;
  disconnectedAt: number | null;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

export class SessionService {
  private sessions = new Map<string, Session>();
  private socketToSession = new Map<string, string>();

  constructor(
    private readonly reconnectTimeoutMs: number,
    private readonly onSessionExpired: (sessionId: string) => void
  ) {}

  /** Create a fresh session bound to a socket. */
  create(socketId: string): Session {
    const session: Session = {
      id: randomUUID(),
      socketId,
      disconnectedAt: null,
      cleanupTimer: null,
    };

    this.sessions.set(session.id, session);
    this.socketToSession.set(socketId, session.id);
    return session;
  }

  /**
   * Attempt to reclaim an existing session with a new socket.
   * Returns the session if it exists and is in grace period, null otherwise.
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

    session.cleanupTimer = setTimeout(() => {
      this.destroy(session.id);
      this.onSessionExpired(session.id);
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
