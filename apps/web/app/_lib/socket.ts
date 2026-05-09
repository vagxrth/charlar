"use client";

import { io, type Socket } from "socket.io-client";
import { env } from "./env";

const SESSION_STORAGE_KEY = "charlar.sessionId";

let socket: Socket | null = null;
let sessionId: string | null = readStoredSessionId();

function readStoredSessionId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeSessionId(value: string): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, value);
  } catch {
    // Storage may be unavailable in private browsing or locked-down contexts.
  }
}

/**
 * Return the singleton socket instance.
 *
 * On first call, creates and connects the socket.
 * On subsequent calls, returns the existing instance.
 * Sends the stored sessionId in handshake auth so the
 * server can reclaim the session after a reconnection.
 */
export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(env.serverUrl, {
    autoConnect: false,
    auth: (cb) => {
      sessionId ??= readStoredSessionId();
      cb({ sessionId });
    },
    // Reconnection tuning for production (mobile networks, deploys)
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
  });

  socket.on("session:created", (data: { sessionId: string }) => {
    sessionId = data.sessionId;
    storeSessionId(data.sessionId);
  });

  socket.connect();

  return socket;
}

/** Read the current session ID (null if not yet assigned by server). */
export function getSessionId(): string | null {
  return sessionId;
}
