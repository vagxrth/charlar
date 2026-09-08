"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Socket } from "socket.io-client";
import { env } from "./env";
import { getSessionId, getSocket } from "./socket";

export type Status = "connecting" | "connected" | "disconnected" | "unreachable";

interface SocketContextValue {
  socket: Socket;
  status: Status;
  sessionId: string | null;
}

const SocketContext = createContext<SocketContextValue | null>(null);

/**
 * Socket.IO retries forever, which makes a backend that is simply gone look
 * exactly like a flaky network — both sit on "reconnecting" indefinitely.
 * After a few failed attempts we probe /health directly. If that fails too,
 * the server is unreachable and the UI should say so instead of implying the
 * user's own connection is at fault.
 */
const FAILURES_BEFORE_HEALTH_PROBE = 3;
const HEALTH_PROBE_TIMEOUT_MS = 5_000;

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Create the singleton socket synchronously on the client so it is available
  // to consumers from the very first render. On the server this stays null and we
  // still render children below — the page must never be blank while waiting on a
  // connection, and effects/handlers that touch the socket only run on the client.
  if (socketRef.current === null && typeof window !== "undefined") {
    socketRef.current = getSocket();
  }

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    let disposed = false;
    let failures = 0;
    let probed = false;

    async function probeHealth() {
      try {
        const res = await fetch(`${env.serverUrl}/health`, {
          signal: AbortSignal.timeout(HEALTH_PROBE_TIMEOUT_MS),
        });
        // A reachable server that answers means the transport is at fault
        // (CORS, a proxy, the connection rate limiter) — leave the status on
        // "disconnected" so the UI keeps promising a retry.
        if (!disposed && !res.ok) setStatus("unreachable");
      } catch {
        // DNS failure, dead host, invalid certificate, or a CORS rejection.
        // The browser reports these identically, and all of them mean the
        // client cannot reach the backend at all.
        if (!disposed) setStatus("unreachable");
      }
    }

    function onConnect() {
      failures = 0;
      probed = false;
      setStatus("connected");
    }

    // Once a probe has established that the server is unreachable, keep saying
    // so until a connection actually succeeds.
    function degrade() {
      setStatus((prev) => (prev === "unreachable" ? prev : "disconnected"));
    }

    function onDisconnect() {
      degrade();
    }

    function onConnectError() {
      degrade();
      failures += 1;
      if (failures >= FAILURES_BEFORE_HEALTH_PROBE && !probed) {
        probed = true;
        void probeHealth();
      }
    }

    function onSessionCreated(data: { sessionId: string }) {
      setSessionId(data.sessionId);
    }

    // Socket may already be connected if getSocket() was called before
    if (socket.connected) {
      setStatus("connected");
      setSessionId(getSessionId());
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("session:created", onSessionCreated);

    return () => {
      disposed = true;
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("session:created", onSessionCreated);
    };
  }, []);

  // Always render children. During SSR the socket is null (never dereferenced
  // server-side); on the client it is set synchronously above, so consumers that
  // read `socket` inside post-mount effects/handlers always get a live instance.
  return (
    <SocketContext value={{ socket: socketRef.current as Socket, status, sessionId }}>
      {children}
    </SocketContext>
  );
}

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return ctx;
}
