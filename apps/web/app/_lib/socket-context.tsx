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

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    function onConnect() {
      setStatus("connected");
    }

    function onDisconnect() {
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
    socket.on("session:created", onSessionCreated);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("session:created", onSessionCreated);
    };
  }, []);

  // Don't render children until we have a socket reference
  if (!socketRef.current) return null;

  return (
    <SocketContext value={{ socket: socketRef.current, status, sessionId }}>
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
