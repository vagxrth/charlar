"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSocket } from "./socket-context";

type Mode = "chat" | "video";

interface Participant {
  sessionId: string;
  online: boolean;
  nickname: string;
}

interface RoomState {
  code: string;
  mode: Mode;
  nickname: string;
  participants: Participant[];
  participantCount: number;
}

interface RoomContextValue {
  room: RoomState | null;
  createRoom: (mode: Mode, nickname?: string) => Promise<string>;
  joinRoom: (code: string, mode: Mode, nickname?: string) => Promise<void>;
  leaveRoom: () => void;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({ children }: { children: ReactNode }) {
  const { socket } = useSocket();
  const [room, setRoom] = useState<RoomState | null>(null);
  const roomRef = useRef(room);
  roomRef.current = room;

  const createRoom = useCallback(
    (mode: Mode, nickname?: string): Promise<string> =>
      new Promise((resolve, reject) => {
        socket.emit(
          "room:create",
          nickname ?? "",
          (res: { ok: boolean; code?: string; nickname?: string; error?: string }) => {
            if (!res.ok || !res.code) {
              reject(new Error(res.error ?? "Failed to create room"));
              return;
            }
            setRoom({
              code: res.code,
              mode,
              nickname: res.nickname ?? "Guest",
              participants: [],
              participantCount: 1,
            });
            resolve(res.code);
          }
        );
      }),
    [socket]
  );

  const joinRoom = useCallback(
    (code: string, mode: Mode, nickname?: string): Promise<void> =>
      new Promise((resolve, reject) => {
        socket.emit(
          "room:join",
          code,
          nickname ?? "",
          (res: {
            ok: boolean;
            error?: string;
            nickname?: string;
            participantCount?: number;
            participants?: Participant[];
          }) => {
            if (!res.ok) {
              reject(new Error(res.error ?? "Failed to join room"));
              return;
            }
            setRoom({
              code,
              mode,
              nickname: res.nickname ?? "Guest",
              participants: res.participants ?? [],
              participantCount: res.participantCount ?? 1,
            });
            resolve();
          }
        );
      }),
    [socket]
  );

  const leaveRoom = useCallback(() => {
    const current = roomRef.current;
    if (!current) return;

    socket.emit("room:leave", current.code, () => {});
    setRoom(null);
  }, [socket]);

  // ── Room events ──────────────────────────────────────
  useEffect(() => {
    function onPeerJoined(data: {
      sessionId: string;
      nickname?: string;
      participantCount: number;
    }) {
      setRoom((prev) => {
        if (!prev) return prev;
        const exists = prev.participants.some(
          (p) => p.sessionId === data.sessionId
        );
        return {
          ...prev,
          participantCount: data.participantCount,
          participants: exists
            ? prev.participants
            : [
                ...prev.participants,
                { sessionId: data.sessionId, online: true, nickname: data.nickname ?? "Unknown" },
              ],
        };
      });
    }

    function onPeerLeft(data: {
      sessionId: string;
      participantCount: number;
    }) {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participantCount: data.participantCount,
          participants: prev.participants.filter(
            (p) => p.sessionId !== data.sessionId
          ),
        };
      });
    }

    function onPeerDisconnected(data: {
      sessionId: string;
      participantCount: number;
    }) {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participantCount: data.participantCount,
          participants: prev.participants.map((p) =>
            p.sessionId === data.sessionId ? { ...p, online: false } : p
          ),
        };
      });
    }

    function onPeerReconnected(data: {
      sessionId: string;
      participantCount: number;
    }) {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participantCount: data.participantCount,
          participants: prev.participants.map((p) =>
            p.sessionId === data.sessionId ? { ...p, online: true } : p
          ),
        };
      });
    }

    socket.on("room:peer-joined", onPeerJoined);
    socket.on("room:peer-left", onPeerLeft);
    socket.on("room:peer-disconnected", onPeerDisconnected);
    socket.on("room:peer-reconnected", onPeerReconnected);

    return () => {
      socket.off("room:peer-joined", onPeerJoined);
      socket.off("room:peer-left", onPeerLeft);
      socket.off("room:peer-disconnected", onPeerDisconnected);
      socket.off("room:peer-reconnected", onPeerReconnected);
    };
  }, [socket]);

  return (
    <RoomContext value={{ room, createRoom, joinRoom, leaveRoom }}>
      {children}
    </RoomContext>
  );
}

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) {
    throw new Error("useRoom must be used within a RoomProvider");
  }
  return ctx;
}
