"use client";

import { useRoom } from "../../../../_lib/room-context";
import { useSocket } from "../../../../_lib/socket-context";

function shortId(id: string): string {
  return id.slice(0, 8);
}

export function PresenceBar() {
  const { sessionId } = useSocket();
  const { room } = useRoom();

  if (!room) return null;

  return (
    <div
      className="flex items-center gap-3 border-b px-4 py-2"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Self */}
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: "#22c55e" }}
        />
        <span className="text-xs font-medium">
          {room.nickname ?? "You"}
        </span>
      </div>

      {/* Peers */}
      {room.participants
        .filter((p) => p.sessionId !== sessionId)
        .map((p) => (
          <div key={p.sessionId} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: p.online ? "#22c55e" : "var(--muted)" }}
            />
            <span
              className="text-xs"
              style={{ color: p.online ? "var(--foreground)" : "var(--muted)" }}
            >
              {p.nickname ?? shortId(p.sessionId)}
              {!p.online && (
                <span className="ml-1 text-[10px]" style={{ color: "var(--muted)" }}>
                  (offline)
                </span>
              )}
            </span>
          </div>
        ))}

      {room.participants.filter((p) => p.sessionId !== sessionId).length ===
        0 && (
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          Waiting for someone to join...
        </span>
      )}
    </div>
  );
}
