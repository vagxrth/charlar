"use client";

import { io, type Socket } from "socket.io-client";
import { env } from "./env";

let socket: Socket | null = null;
let sessionId: string | null = null;

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
      cb({ sessionId });
    },
    // Reconnection tuning for production (mobile networks, deploys)
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
  });

  socket.on("session:created", (data: { sessionId: string }) => {
    sessionId = data.sessionId;
  });

  socket.connect();

  return socket;
}

/** Read the current session ID (null if not yet assigned by server). */
export function getSessionId(): string | null {
  return sessionId;
}
