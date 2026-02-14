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
      className="flex items-center justify-between border-b px-4 py-3"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">Room {room.code}</span>
        <span
          className="rounded-md px-2 py-0.5 text-xs font-medium"
          style={{
            background: "var(--surface-hover)",
            color: "var(--muted)",
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
            as <span className="font-medium" style={{ color: "var(--foreground)" }}>{room.nickname}</span>
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={handleLeave}
        className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
        style={{
          borderColor: "var(--border)",
          color: "var(--error)",
          background: "var(--surface)",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "var(--surface-hover)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = "var(--surface)")
        }
      >
        Leave
      </button>
    </header>
  );
}
