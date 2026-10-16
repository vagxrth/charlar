"use client";

import { io, type Socket } from "socket.io-client";
import { env } from "./env";

// Per tab: sessionStorage survives a reload, which is all room restore needs,
// but isn't shared between tabs, so a second tab can't take over this one's
// session. The resume token proves ownership when reconnecting.
const SESSION_STORAGE_KEY = "charlar.session";

// Earlier builds kept these in localStorage, which every tab shared.
const LEGACY_LOCAL_KEYS = ["charlar.sessionId", "charlar.room"];

interface StoredSession {
  sessionId: string;
  resumeToken?: string;
}

let socket: Socket | null = null;
let session: StoredSession | null = readStoredSession();

function readStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof parsed.sessionId !== "string") return null;

    return {
      sessionId: parsed.sessionId,
      resumeToken:
        typeof parsed.resumeToken === "string" ? parsed.resumeToken : undefined,
    };
  } catch {
    return null;
  }
}

function storeSession(value: StoredSession): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage may be unavailable in private browsing or locked-down contexts.
  }
}

function clearLegacyStorage(): void {
  if (typeof window === "undefined") return;

  try {
    for (const key of LEGACY_LOCAL_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Storage may be unavailable in private browsing or locked-down contexts.
  }
}

/**
 * Return the singleton socket instance.
 *
 * On first call, creates and connects the socket.
 * On subsequent calls, returns the existing instance.
 * Sends the stored sessionId and resumeToken in handshake auth so the
 * server can hand this tab its session back after a reconnection.
 */
export function getSocket(): Socket {
  if (socket) return socket;

  clearLegacyStorage();

  socket = io(env.serverUrl, {
    autoConnect: false,
    auth: (cb) => {
      session ??= readStoredSession();
      cb(session ?? {});
    },
    // Reconnection tuning for production (mobile networks, deploys)
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
  });

  socket.on(
    "session:created",
    (data: { sessionId: string; resumeToken?: string }) => {
      session = { sessionId: data.sessionId, resumeToken: data.resumeToken };
      storeSession(session);
    }
  );

  socket.connect();

  return socket;
}

/** Read the current session ID (null if not yet assigned by server). */
export function getSessionId(): string | null {
  return session?.sessionId ?? null;
}
