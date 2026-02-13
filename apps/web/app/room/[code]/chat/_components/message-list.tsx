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
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className="flex max-w-[75%] flex-col gap-1 rounded-xl px-3.5 py-2.5 sm:max-w-[60%]"
        style={{
          background: isOwn ? "var(--accent)" : "var(--surface)",
          color: isOwn ? "#ffffff" : "var(--foreground)",
          border: isOwn ? "none" : "1px solid var(--border)",
          opacity: message.pending ? 0.6 : 1,
        }}
      >
        {!isOwn && (
          <span
            className="text-[10px] font-medium"
            style={{ color: isOwn ? "rgba(255,255,255,0.7)" : "var(--muted)" }}
          >
            {shortId(message.sessionId)}
          </span>
        )}
        <p className="whitespace-pre-wrap break-words text-sm">
          {message.content}
        </p>
        <span
          className="self-end text-[10px]"
          style={{ color: isOwn ? "rgba(255,255,255,0.6)" : "var(--muted)" }}
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
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          No messages yet. Start the conversation.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isOwn={msg.sessionId === sessionId}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
