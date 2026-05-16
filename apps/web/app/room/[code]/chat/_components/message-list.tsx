"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { useSocket } from "../../../../_lib/socket-context";
import type { ChatMessage } from "../_hooks/use-chat";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) return "Today";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

const MessageBubble = memo(function MessageBubble({
  message,
  isOwn,
  showAuthor,
  tail,
}: {
  message: ChatMessage;
  isOwn: boolean;
  showAuthor: boolean;
  tail: boolean;
}) {
  return (
    <div
      className={`flex animate-slide-up ${isOwn ? "justify-end" : "justify-start"}`}
    >
      <div
        className="flex max-w-[80%] flex-col gap-1 px-4 py-2.5 sm:max-w-[62%]"
        style={{
          background: isOwn
            ? "linear-gradient(135deg, var(--accent) 0%, oklch(72% 0.10 175) 100%)"
            : "var(--surface)",
          color: isOwn ? "oklch(15% 0.01 70)" : "var(--foreground)",
          border: isOwn ? "none" : "1px solid var(--border)",
          opacity: message.pending ? 0.6 : 1,
          boxShadow: isOwn
            ? "0 4px 16px var(--accent-glow)"
            : "0 1px 2px rgba(0,0,0,0.03)",
          borderRadius: isOwn
            ? `18px 18px ${tail ? "6px" : "18px"} 18px`
            : `18px 18px 18px ${tail ? "6px" : "18px"}`,
        }}
      >
        {!isOwn && showAuthor && (
          <span
            className="text-[10.5px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--muted)", letterSpacing: "0.08em" }}
          >
            {message.nickname ?? shortId(message.sessionId)}
          </span>
        )}
        <p className="whitespace-pre-wrap break-words text-[14.5px] leading-snug">
          {message.content}
        </p>
        <span
          className="self-end text-[10px] text-mono"
          style={{
            color: isOwn ? "rgba(0,0,0,0.4)" : "var(--muted)",
            marginTop: 2,
          }}
        >
          {formatTime(message.timestamp)}
          {message.pending && " · sending"}
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

  /**
   * Pre-compute, for each chat-message index, whether it shares
   * a sender with the previous chat-message (skipping system rows).
   * This drives the "tail / show-author" grouping treatment.
   */
  const grouping = useMemo(() => {
    const map = new Map<string, { groupedWithPrev: boolean; isLastInGroup: boolean }>();
    let prevSender: string | null = null;
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i]!;
      if (m.type === "system") {
        prevSender = null;
        continue;
      }
      const grouped = prevSender === m.sessionId;
      map.set(m.id, { groupedWithPrev: grouped, isLastInGroup: true });
      // Mark previous-in-group as not-last
      if (grouped) {
        let j = i - 1;
        while (j >= 0) {
          const pm = messages[j]!;
          if (pm.type !== "system") {
            map.set(pm.id, { ...(map.get(pm.id) ?? { groupedWithPrev: false, isLastInGroup: true }), isLastInGroup: false });
            break;
          }
          j--;
        }
      }
      prevSender = m.sessionId;
    }
    return map;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="relative flex flex-1 flex-col items-center justify-center gap-4 px-6">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full animate-float-gentle"
          style={{
            background: "var(--accent-soft)",
            boxShadow: "0 12px 32px var(--accent-glow)",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div className="text-center">
          <p
            className="text-display text-lg"
            style={{ color: "var(--foreground)", fontStyle: "italic", fontWeight: 300 }}
          >
            a quiet room awaits
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            Say hello. Messages here are ephemeral.
          </p>
        </div>
      </div>
    );
  }

  // Insert date dividers when day changes between consecutive messages
  const rendered: React.ReactNode[] = [];
  let lastDay: string | null = null;

  for (const msg of messages) {
    const day = formatDay(msg.timestamp);
    if (day !== lastDay) {
      rendered.push(
        <div key={`day-${msg.id}`} className="flex items-center justify-center gap-3 py-2 animate-fade-in">
          <span className="h-px flex-1 max-w-[120px]" style={{ background: "var(--border)" }} />
          <span className="label-eyebrow">{day}</span>
          <span className="h-px flex-1 max-w-[120px]" style={{ background: "var(--border)" }} />
        </div>
      );
      lastDay = day;
    }

    if (msg.type === "system") {
      rendered.push(
        <div key={msg.id} className="flex justify-center py-1 animate-fade-in">
          <span
            className="rounded-full px-3 py-1 text-[11px]"
            style={{
              background: "var(--accent-soft)",
              color: "var(--accent)",
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontWeight: 400,
            }}
          >
            {msg.content}
          </span>
        </div>
      );
      continue;
    }

    const isOwn = msg.sessionId === sessionId;
    const g = grouping.get(msg.id) ?? { groupedWithPrev: false, isLastInGroup: true };
    rendered.push(
      <MessageBubble
        key={msg.id}
        message={msg}
        isOwn={isOwn}
        showAuthor={!isOwn && !g.groupedWithPrev}
        tail={g.isLastInGroup}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-4 py-5">
      {rendered}
      <div ref={bottomRef} />
    </div>
  );
}
