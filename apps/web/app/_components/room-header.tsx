"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useRoom } from "../_lib/room-context";

const MODE_ICON: Record<string, React.ReactNode> = {
  chat: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  video: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
};

interface RoomHeaderProps {
  /** When true, render in dark/overlay mode (light text on a dark video bg). */
  overlay?: boolean;
}

export function RoomHeader({ overlay = false }: RoomHeaderProps) {
  const router = useRouter();
  const { room, leaveRoom } = useRoom();
  const [copied, setCopied] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  useEffect(() => {
    if (!confirmingLeave) return;
    const t = setTimeout(() => setConfirmingLeave(false), 2400);
    return () => clearTimeout(t);
  }, [confirmingLeave]);

  if (!room) return null;

  async function handleCopy() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
    } catch {
      // Fallback selection for older browsers
      const input = document.createElement("input");
      input.value = room.code;
      document.body.appendChild(input);
      input.select();
      try { document.execCommand("copy"); setCopied(true); } catch { /* ignore */ }
      document.body.removeChild(input);
    }
  }

  function handleLeave() {
    if (!confirmingLeave) {
      setConfirmingLeave(true);
      return;
    }
    leaveRoom();
    router.replace("/");
  }

  // Color tokens shift in overlay mode
  const fgPrimary = overlay ? "rgba(255,255,255,0.95)" : "var(--foreground)";
  const fgMuted = overlay ? "rgba(255,255,255,0.55)" : "var(--muted)";
  const bgPill = overlay ? "rgba(255,255,255,0.08)" : "var(--accent-soft)";
  const accent = overlay ? "rgba(255,255,255,0.8)" : "var(--accent)";
  const borderCol = overlay ? "rgba(255,255,255,0.10)" : "var(--border)";

  return (
    <header
      className="relative flex items-center justify-between gap-3 px-5 py-3 animate-fade-in"
      style={{
        borderBottom: overlay ? "none" : `1px solid var(--border)`,
        background: overlay ? "transparent" : "var(--surface)",
      }}
    >
      <div className="flex flex-1 items-center gap-3 overflow-hidden">
        {/* Room code + copy */}
        <button
          type="button"
          onClick={handleCopy}
          className="group relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-mono text-sm font-semibold transition-all duration-200"
          style={{
            color: fgPrimary,
            background: "transparent",
            letterSpacing: "0.06em",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = overlay
              ? "rgba(255,255,255,0.06)"
              : "var(--surface-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
          aria-label={`Copy room code ${room.code}`}
          title="Copy room code"
        >
          <span>{room.code}</span>
          <span
            className="flex h-5 w-5 items-center justify-center rounded-md transition-opacity duration-200"
            style={{
              opacity: 0.55,
              color: copied ? "var(--success)" : "inherit",
            }}
          >
            {copied ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </span>
        </button>

        {/* Mode pill */}
        <span
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.12em]"
          style={{
            background: bgPill,
            color: accent,
            backdropFilter: overlay ? "blur(8px)" : undefined,
          }}
        >
          {MODE_ICON[room.mode]}
          {room.mode}
        </span>

        {/* Participants */}
        <span
          className="hidden text-xs sm:inline"
          style={{ color: fgMuted }}
        >
          {room.participantCount}{" "}
          {room.participantCount === 1 ? "person" : "people"}
        </span>

        {room.nickname && (
          <span
            className="hidden text-xs sm:inline"
            style={{ color: fgMuted }}
          >
            ·{" "}
            <span style={{ color: fgPrimary, fontWeight: 500 }}>
              {room.nickname}
            </span>
          </span>
        )}
      </div>

      {/* Right side: copied toast + leave */}
      <div className="flex items-center gap-2">
        {copied && (
          <span
            className="animate-fade-in label-eyebrow"
            style={{ color: overlay ? "rgba(255,255,255,0.7)" : "var(--success)" }}
          >
            copied
          </span>
        )}

        <button
          type="button"
          onClick={handleLeave}
          className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200"
          style={{
            color: confirmingLeave
              ? overlay ? "white" : "white"
              : "var(--error)",
            background: confirmingLeave ? "var(--error)" : "transparent",
            border: `1px solid ${confirmingLeave ? "var(--error)" : borderCol}`,
            backdropFilter: overlay ? "blur(8px)" : undefined,
          }}
          onMouseEnter={(e) => {
            if (!confirmingLeave) {
              e.currentTarget.style.background = "var(--error-soft)";
              e.currentTarget.style.borderColor = "var(--error)";
            }
          }}
          onMouseLeave={(e) => {
            if (!confirmingLeave) {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = borderCol;
            }
          }}
        >
          {confirmingLeave ? "Confirm leave" : "Leave"}
        </button>
      </div>
    </header>
  );
}
