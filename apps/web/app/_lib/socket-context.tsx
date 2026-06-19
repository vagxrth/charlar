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
import { getSessionId, getSocket } from "./socket";

type Status = "connecting" | "connected" | "disconnected";

interface SocketContextValue {
  socket: Socket;
  status: Status;
  sessionId: string | null;
}

const SocketContext = createContext<SocketContextValue | null>(null);

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

    function onConnect() {
      setStatus("connected");
    }

    function onDisconnect() {
      setStatus("disconnected");
    }

    function onConnectError() {
      setStatus("disconnected");
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
