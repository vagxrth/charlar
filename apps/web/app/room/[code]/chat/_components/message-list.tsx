"use client";

import { memo, useEffect, useRef } from "react";
import { useSocket } from "../../../../_lib/socket-context";
import type { ChatMessage } from "../_hooks/use-chat";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

const MessageBubble = memo(function MessageBubble({
  message,
  isOwn,
}: {
  message: ChatMessage;
  isOwn: boolean;
}) {
  return (
    <div
      className={`flex animate-slide-up ${isOwn ? "justify-end" : "justify-start"}`}
    >
      <div
        className="flex max-w-[75%] flex-col gap-1 rounded-2xl px-4 py-3 sm:max-w-[60%]"
        style={{
          background: isOwn ? "var(--accent)" : "var(--surface)",
          color: isOwn ? "#ffffff" : "var(--foreground)",
          border: isOwn ? "none" : "1px solid var(--border)",
          opacity: message.pending ? 0.6 : 1,
          boxShadow: isOwn
            ? "none"
            : "0 1px 2px rgba(0,0,0,0.03)",
        }}
      >
        {!isOwn && (
          <span
            className="text-[10px] font-medium"
            style={{
              color: "var(--muted)",
            }}
          >
            {message.nickname ?? shortId(message.sessionId)}
          </span>
        )}
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {message.content}
        </p>
        <span
          className="self-end text-[10px]"
          style={{
            color: isOwn ? "rgba(255,255,255,0.6)" : "var(--muted)",
          }}
        >
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
});

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  const { sessionId } = useSocket();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full animate-breathe"
          style={{ background: "var(--accent-soft)" }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          No messages yet. Start the conversation.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4">
      {messages.map((msg) =>
        msg.type === "system" ? (
          <div key={msg.id} className="flex justify-center py-1 animate-fade-in">
            <span
              className="rounded-full px-3.5 py-1 text-[11px]"
              style={{
                background: "var(--accent-soft)",
                color: "var(--muted)",
              }}
            >
              {msg.content}
            </span>
          </div>
        ) : (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.sessionId === sessionId}
          />
        )
      )}
      <div ref={bottomRef} />
    </div>
  );
}
