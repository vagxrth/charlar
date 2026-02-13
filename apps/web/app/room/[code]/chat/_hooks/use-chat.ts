"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRoom } from "../../../../_lib/room-context";
import { useSocket } from "../../../../_lib/socket-context";

export interface ChatMessage {
  id: string;
  sessionId: string;
  content: string;
  timestamp: number;
  pending?: boolean;
}

const TYPING_DEBOUNCE_MS = 2_000;
const MAX_MESSAGES = 500;

export function useChat() {
  const { socket, sessionId } = useSocket();
  const { room } = useRoom();
  const roomCode = room?.code ?? "";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peerTyping, setPeerTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTyping = useRef(false);

  // ── Receive messages ─────────────────────────────────
  useEffect(() => {
    function onMessage(data: {
      id: string;
      sessionId: string;
      content: string;
      timestamp: number;
    }) {
      setMessages((prev) => {
        const next = [...prev, data];
        return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
      });
    }

    socket.on("chat:message", onMessage);
    return () => {
      socket.off("chat:message", onMessage);
    };
  }, [socket]);

  // ── Receive typing indicators ────────────────────────
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    function onTypingStart(data: { sessionId: string }) {
      if (data.sessionId === sessionId) return;
      setPeerTyping(true);
      if (timeout) clearTimeout(timeout);
      // Auto-clear if no stop arrives (safety net)
      timeout = setTimeout(() => setPeerTyping(false), 6_000);
    }

    function onTypingStop(data: { sessionId: string }) {
      if (data.sessionId === sessionId) return;
      setPeerTyping(false);
      if (timeout) clearTimeout(timeout);
    }

    socket.on("typing:start", onTypingStart);
    socket.on("typing:stop", onTypingStop);
    return () => {
      socket.off("typing:start", onTypingStart);
      socket.off("typing:stop", onTypingStop);
      if (timeout) clearTimeout(timeout);
    };
  }, [socket, sessionId]);

  // ── Clean up typing state on unmount ─────────────────
  useEffect(() => {
    return () => {
      if (isTyping.current && roomCode) {
        socket.emit("typing:stop", roomCode, () => {});
      }
    };
  }, [socket, roomCode]);

  // ── Send message ─────────────────────────────────────
  const sendMessage = useCallback(
    (content: string) => {
      if (!roomCode || !sessionId) return;

      const tempId = crypto.randomUUID();
      const optimistic: ChatMessage = {
        id: tempId,
        sessionId,
        content,
        timestamp: Date.now(),
        pending: true,
      };

      setMessages((prev) => {
        const next = [...prev, optimistic];
        return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
      });

      // Stop typing on send
      if (isTyping.current) {
        isTyping.current = false;
        if (typingTimer.current) {
          clearTimeout(typingTimer.current);
          typingTimer.current = null;
        }
      }

      socket.emit(
        "chat:message",
        { roomCode, content },
        (res: { ok: boolean; id?: string; timestamp?: number }) => {
          if (res.ok && res.id && res.timestamp) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempId
                  ? { ...m, id: res.id!, timestamp: res.timestamp!, pending: false }
                  : m
              )
            );
          } else {
            // Remove failed message
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
          }
        }
      );
    },
    [socket, roomCode, sessionId]
  );

  // ── Typing indicator emit ────────────────────────────
  const handleTyping = useCallback(() => {
    if (!roomCode) return;

    if (!isTyping.current) {
      isTyping.current = true;
      socket.emit("typing:start", roomCode, () => {});
    }

    // Reset the debounce timer
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTyping.current = false;
      socket.emit("typing:stop", roomCode, () => {});
      typingTimer.current = null;
    }, TYPING_DEBOUNCE_MS);
  }, [socket, roomCode]);

  return { messages, sendMessage, handleTyping, peerTyping };
}
