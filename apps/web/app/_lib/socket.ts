"use client";

import { io, type Socket } from "socket.io-client";
import { env } from "./env";

// Per tab: sessionStorage survives a reload, which is all room restore needs,
// but isn't shared between tabs, so a second tab can't take over this one's
// session. The resume token proves ownership when reconnecting.
const SESSION_STORAGE_KEY = "charlar.session";

// Earlier builds kept these in localStorage, which every tab shared.
const LEGACY_LOCAL_KEYS = ["charlar.sessionId", "charlar.room"];

/**
 * How long to wait for the server to acknowledge a request before treating
 * it as failed. The server drops events over its rate limit without replying,
 * so without this a lost reply leaves the UI waiting forever.
 */
export const ACK_TIMEOUT_MS = 10_000;

interface StoredSession {
  sessionId: string;
  resumeToken?: string;
}

let socket: Socket | null = null;
let session: StoredSession | null = readStoredSession();

// Protocol features the connected server announced in session:created. The
// web app can deploy before the server, so newer call shapes wait for these.
let serverFeatures = new Set<string>();
let featuresKnown = false;

/**
 * Call signaling that arrived while no video page was listening. The other
 * person sends their offer the moment we join, often while this tab is still
 * navigating from the lobby; without this it would be dropped and the call
 * would never connect. Held briefly, then replayed when the video page mounts.
 */
export interface EarlySignal {
  event: "signal:offer" | "signal:ice-candidate";
  data: { sessionId: string } & Record<string, unknown>;
  at: number;
}

const EARLY_SIGNAL_TTL_MS = 60_000;
const EARLY_SIGNAL_LIMIT = 100;
let earlySignals: EarlySignal[] = [];
let signalConsumerAttached = false;

function holdEarlySignal(event: EarlySignal["event"], data: EarlySignal["data"]): void {
  if (signalConsumerAttached) return;
  earlySignals.push({ event, data, at: Date.now() });
  if (earlySignals.length > EARLY_SIGNAL_LIMIT) earlySignals.shift();
}

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
    (data: { sessionId: string; resumeToken?: string; features?: string[] }) => {
      session = { sessionId: data.sessionId, resumeToken: data.resumeToken };
      storeSession(session);
      serverFeatures = new Set(Array.isArray(data.features) ? data.features : []);
      featuresKnown = true;
    }
  );

  socket.on("signal:offer", (data: EarlySignal["data"]) => holdEarlySignal("signal:offer", data));
  socket.on("signal:ice-candidate", (data: EarlySignal["data"]) =>
    holdEarlySignal("signal:ice-candidate", data)
  );

  socket.connect();

  return socket;
}

/** Read the current session ID (null if not yet assigned by server). */
export function getSessionId(): string | null {
  return session?.sessionId ?? null;
}

/**
 * Called by the video page once its own signaling listeners are registered:
 * stops holding signals and returns those that arrived earlier, oldest first.
 */
export function attachSignalConsumer(): EarlySignal[] {
  signalConsumerAttached = true;
  const cutoff = Date.now() - EARLY_SIGNAL_TTL_MS;
  const held = earlySignals.filter((s) => s.at >= cutoff);
  earlySignals = [];
  return held;
}

/** Called when the video page unmounts, so signals are held again. */
export function detachSignalConsumer(): void {
  signalConsumerAttached = false;
}

/** Whether the connected server announced support for a protocol feature. */
export function serverSupports(feature: string): boolean {
  return serverFeatures.has(feature);
}

/**
 * Resolve true once the server has announced its features, or false after
 * `timeoutMs`. Needed right after a reload, before session:created arrives.
 */
export function whenServerKnown(timeoutMs: number): Promise<boolean> {
  const s = socket;
  if (featuresKnown || !s) return Promise.resolve(featuresKnown);

  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      s.off("session:created", done);
      resolve(featuresKnown);
    };
    const timer = setTimeout(done, timeoutMs);
    // Registered after getSocket's own listener, so features are set by now.
    s.on("session:created", done);
  });
}
