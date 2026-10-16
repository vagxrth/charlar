import type { Server as HttpServer } from "node:http";

import { Server, type Socket } from "socket.io";

import { config } from "../config/env.js";
import { logger } from "../logger.js";
import {
  presenceService,
  roomService,
  sessionService,
  setSessionExpiryNotifier,
  typingService,
} from "../services/index.js";
import type { Session } from "../services/session-service.js";
import { chatHandler } from "./handlers/chat.js";
import { iceHandler } from "./handlers/ice.js";
import { presenceHandler } from "./handlers/presence.js";
import { roomsHandler } from "./handlers/rooms.js";
import { signalingHandler } from "./handlers/signaling.js";
import type { SocketHandler } from "./types.js";

const handlers: SocketHandler[] = [
  roomsHandler,
  chatHandler,
  presenceHandler,
  signalingHandler,
  iceHandler,
];

// ── Connection rate limiting per IP ─────────────────────
const MAX_CONNECTIONS_PER_WINDOW = 10;
const CONNECTION_WINDOW_MS = 60_000;
const connectionTimestamps = new Map<string, number[]>();

/**
 * The client's address as seen through the reverse proxy.
 *
 * `handshake.address` is whoever opened the TCP connection, which behind Caddy
 * is the proxy itself — an identical value for every user, which would turn the
 * per-IP limit below into a global one (ten connections a minute for the whole
 * service, with Socket.IO's own retries consuming the budget). Express resolves
 * this via `app.set("trust proxy", 1)`, but that is an Express setting and does
 * not reach Socket.IO, so the forwarded header has to be read here as well.
 *
 * Trusting a client-supplied header is only safe because Caddy overwrites it
 * with the real peer address. Do not expose this server to the internet without
 * the proxy in front, or the limit becomes trivially forgeable.
 */
function clientIp(socket: Socket): string {
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  const chain = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  // Left-most entry is the original client; the rest are intermediate proxies.
  return chain?.split(",")[0]?.trim() || socket.handshake.address;
}

function isConnectionAllowed(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - CONNECTION_WINDOW_MS;

  let timestamps = connectionTimestamps.get(ip);
  if (!timestamps) {
    timestamps = [];
    connectionTimestamps.set(ip, timestamps);
  }

  while (timestamps.length > 0 && timestamps[0]! < cutoff) {
    timestamps.shift();
  }

  if (timestamps.length >= MAX_CONNECTIONS_PER_WINDOW) return false;
  timestamps.push(now);
  return true;
}

// ── Per-socket event rate limiting ──────────────────────
const EVENT_RATE_LIMIT = 50;
const EVENT_WINDOW_MS = 5_000;

// ── Periodic cleanup intervals ──────────────────────────
const REAP_INTERVAL_MS = 5 * 60_000;

/**
 * Protocol features this server supports, announced in session:created.
 * The web app deploys separately (and sometimes first), so it only uses a
 * newer call shape after the server it's talking to has announced it.
 */
const SERVER_FEATURES = ["room-mode", "ice-config"];

/**
 * Resolve or create a session for the connecting socket.
 *
 * A client reclaims its previous session by sending both the sessionId and
 * the resumeToken it was given in `session:created`. Session IDs are shared
 * with peers, so only the token proves ownership; without a matching token the
 * client gets a fresh session and the current holder is left alone.
 *
 * On a verified reclaim, force-disconnects the old socket if it's still
 * lingering (transport race condition — it hasn't fully closed yet).
 */
function resolveSession(
  io: Server,
  socket: Socket
): { session: Session; reconnected: boolean } {
  const auth = (socket.handshake.auth ?? {}) as Record<string, unknown>;
  const previousId = auth["sessionId"];
  const resumeToken = auth["resumeToken"];

  if (typeof previousId === "string" && typeof resumeToken === "string") {
    const existing = sessionService.verify(previousId, resumeToken);
    if (existing) {
      // Force-close stale socket before reclaiming
      if (existing.socketId && existing.socketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(existing.socketId);
        if (oldSocket) {
          logger.warn(
            { session: previousId.slice(0, 8), oldSocketId: existing.socketId },
            "force-closing stale socket before reclaim"
          );
          oldSocket.disconnect(true);
        }
      }

      const session = sessionService.reclaim(previousId, socket.id);
      if (session) {
        return { session, reconnected: true };
      }
    }
  }

  return { session: sessionService.create(socket.id), reconnected: false };
}

export function initSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin,
    },
    // Limit payload size — SDP is typically 2-10KB, 1MB is generous
    maxHttpBufferSize: 1e6,
    // Give mobile networks more time before declaring disconnect
    pingTimeout: 30_000,
  });

  // ── Deferred callbacks that need `io` ──────────────────

  // Wire typing auto-expire broadcasts to the io instance
  typingService.setOnExpired((roomCode, sessionId) => {
    io.volatile.to(roomCode).emit("typing:stop", { sessionId });
  });

  // Notify remaining room members when a session's grace period expires
  setSessionExpiryNotifier((sessionId, nickname, codes) => {
    for (const code of codes) {
      const participantCount = presenceService.getParticipantCount(code);
      io.to(code).emit("room:peer-left", { sessionId, nickname, participantCount });
    }
  });

  // ── Middleware ──────────────────────────────────────────

  // Reject connections that exceed the per-IP rate limit
  io.use((socket, next) => {
    const ip = clientIp(socket);
    if (!isConnectionAllowed(ip)) {
      logger.warn({ ip }, "connection rate limited");
      next(new Error("Too many connections"));
      return;
    }
    next();
  });

  // ── Connection handler ─────────────────────────────────

  io.on("connection", (socket) => {
    const { session, reconnected } = resolveSession(io, socket);
    const sessionId = session.id;
    socket.data.sessionId = sessionId;

    const tag = sessionId.slice(0, 8);

    // Per-socket event throttle (sliding window)
    const eventTimestamps: number[] = [];
    socket.use(([eventName], next) => {
      // Don't throttle disconnect (internal)
      if (eventName === "disconnect") {
        next();
        return;
      }

      const now = Date.now();
      const cutoff = now - EVENT_WINDOW_MS;

      while (eventTimestamps.length > 0 && eventTimestamps[0]! < cutoff) {
        eventTimestamps.shift();
      }

      if (eventTimestamps.length >= EVENT_RATE_LIMIT) {
        logger.warn({ session: tag }, "socket event rate limited");
        next(new Error("Rate limit exceeded"));
        return;
      }

      eventTimestamps.push(now);
      next();
    });

    // Log socket-level errors (from middleware rejections or transport issues)
    socket.on("error", (err) => {
      logger.error({ session: tag, err: err.message }, "socket error");
    });

    if (reconnected) {
      // Rejoin Socket.IO rooms and notify peers
      const codes = roomService.getRoomsBySession(sessionId);
      const nickname = sessionService.getById(sessionId)?.nickname ?? null;
      for (const code of codes) {
        void socket.join(code);
        const participantCount = presenceService.getParticipantCount(code);
        socket.to(code).emit("room:peer-reconnected", {
          sessionId,
          nickname,
          participantCount,
        });
      }
      logger.info(
        { session: tag, rooms: codes.length },
        "session reconnected, rooms restored"
      );
    } else {
      logger.info({ session: tag }, "new session connected");
    }

    // Send the session ID and its resume token to this client only, so it can
    // reclaim the session after a reconnect
    socket.emit("session:created", {
      sessionId,
      resumeToken: session.resumeToken,
      features: SERVER_FEATURES,
    });

    // Register domain handlers
    for (const handler of handlers) {
      handler(io, socket);
    }

    socket.on("disconnect", (reason) => {
      // Clear typing state and broadcast stop for each room
      const typingRooms = typingService.clearSession(sessionId);
      for (const code of typingRooms) {
        socket.volatile.to(code).emit("typing:stop", { sessionId });
      }

      const session = sessionService.handleDisconnect(socket.id);
      if (session) {
        const codes = roomService.getRoomsBySession(session.id);
        for (const code of codes) {
          const participantCount = presenceService.getParticipantCount(code);
          socket.to(code).emit("room:peer-disconnected", {
            sessionId: session.id,
            nickname: session.nickname,
            participantCount,
          });
        }
        logger.info(
          { session: tag, reason, rooms: codes.length },
          "socket disconnected, grace period started"
        );
      } else {
        logger.info({ socketId: socket.id, reason }, "socket disconnected (no session)");
      }
    });
  });

  // ── Periodic maintenance ──────────────────────────────

  // Clean up stale IP rate-limit entries
  const ipCleanupTimer = setInterval(() => {
    const cutoff = Date.now() - CONNECTION_WINDOW_MS;
    for (const [ip, timestamps] of connectionTimestamps) {
      while (timestamps.length > 0 && timestamps[0]! < cutoff) {
        timestamps.shift();
      }
      if (timestamps.length === 0) connectionTimestamps.delete(ip);
    }
  }, REAP_INTERVAL_MS);
  ipCleanupTimer.unref();

  // Reap rooms that reference sessions which no longer exist (safety net)
  const roomReapTimer = setInterval(() => {
    const reaped = roomService.reapStale((sid) => sessionService.getById(sid) !== null);
    if (reaped > 0) {
      logger.warn({ reaped }, "reaped stale rooms");
    }
  }, REAP_INTERVAL_MS);
  roomReapTimer.unref();

  return io;
}
