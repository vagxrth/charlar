"use client";

import { useRouter } from "next/navigation";
import { useRoom } from "../_lib/room-context";

export function RoomHeader() {
  const router = useRouter();
  const { room, leaveRoom } = useRoom();

  if (!room) return null;

  function handleLeave() {
    leaveRoom();
    router.replace("/");
  }

  return (
    <header
      className="flex items-center justify-between px-5 py-3.5 animate-fade-in"
      style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="text-sm font-semibold font-[family-name:var(--font-display)]"
          style={{ color: "var(--foreground)" }}
        >
          Room {room.code}
        </span>
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
          style={{
            background: "var(--accent-soft)",
            color: "var(--accent)",
          }}
        >
          {room.mode}
        </span>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {room.participantCount}{" "}
          {room.participantCount === 1 ? "participant" : "participants"}
        </span>
        {room.nickname && (
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            as{" "}
            <span
              className="font-medium"
              style={{ color: "var(--foreground)" }}
            >
              {room.nickname}
            </span>
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={handleLeave}
        className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200"
        style={{
          color: "var(--error)",
          background: "transparent",
          border: "1px solid var(--border)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--error-soft)";
          e.currentTarget.style.borderColor = "var(--error)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.borderColor = "var(--border)";
        }}
      >
        Leave
      </button>
    </header>
  );
}
