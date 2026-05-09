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
import { getSessionId as getSocketSessionId } from "./socket";
import { useSocket } from "./socket-context";

export type Mode = "chat" | "video";

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
  restoreRoom: (code: string, mode: Mode) => Promise<boolean>;
  leaveRoom: () => void;
}

const ROOM_STORAGE_KEY = "charlar.room";

const RoomContext = createContext<RoomContextValue | null>(null);

function isParticipant(value: unknown): value is Participant {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Participant>;
  return (
    typeof candidate.sessionId === "string" &&
    typeof candidate.online === "boolean" &&
    typeof candidate.nickname === "string"
  );
}

function readStoredRoom(): RoomState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(ROOM_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<RoomState>;
    if (
      typeof parsed.code !== "string" ||
      (parsed.mode !== "chat" && parsed.mode !== "video") ||
      typeof parsed.nickname !== "string" ||
      !Array.isArray(parsed.participants)
    ) {
      return null;
    }

    const participants = parsed.participants.filter(isParticipant);
    return {
      code: parsed.code,
      mode: parsed.mode,
      nickname: parsed.nickname,
      participants,
      participantCount:
        typeof parsed.participantCount === "number"
          ? parsed.participantCount
          : participants.length,
    };
  } catch {
    return null;
  }
}

function writeStoredRoom(room: RoomState | null): void {
  if (typeof window === "undefined") return;

  try {
    if (room) {
      window.localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(room));
    } else {
      window.localStorage.removeItem(ROOM_STORAGE_KEY);
    }
  } catch {
    // Storage may be unavailable in private browsing or locked-down contexts.
  }
}

export function RoomProvider({ children }: { children: ReactNode }) {
  const { socket, sessionId } = useSocket();
  const [room, setRoom] = useState<RoomState | null>(null);
  const roomRef = useRef(room);
  roomRef.current = room;

  useEffect(() => {
    if (room) {
      writeStoredRoom(room);
    }
  }, [room]);

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

  const restoreRoom = useCallback(
    (code: string, mode: Mode): Promise<boolean> =>
      new Promise((resolve) => {
        const storedRoom = readStoredRoom();

        socket.emit(
          "presence:request",
          code,
          (res: {
            ok: boolean;
            error?: string;
            participantCount?: number;
            participants?: Participant[];
          }) => {
            if (!res.ok) {
              if (storedRoom?.code === code) {
                writeStoredRoom(null);
              }
              setRoom((prev) => (prev?.code === code ? null : prev));
              resolve(false);
              return;
            }

            const participants = res.participants ?? [];
            const currentSessionId = sessionId ?? getSocketSessionId();
            const ownParticipant = participants.find(
              (participant) => participant.sessionId === currentSessionId
            );

            setRoom({
              code,
              mode,
              nickname:
                ownParticipant?.nickname ??
                storedRoom?.nickname ??
                roomRef.current?.nickname ??
                "Guest",
              participants,
              participantCount: res.participantCount ?? participants.length,
            });
            resolve(true);
          }
        );
      }),
    [socket, sessionId]
  );

  const leaveRoom = useCallback(() => {
    const current = roomRef.current;
    if (!current) return;

    socket.emit("room:leave", current.code, () => {});
    writeStoredRoom(null);
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
    <RoomContext value={{ room, createRoom, joinRoom, restoreRoom, leaveRoom }}>
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
