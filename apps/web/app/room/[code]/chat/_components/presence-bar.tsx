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
      className="flex items-center gap-3 px-5 py-2.5 animate-fade-in"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      {/* Self */}
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{
            background: "var(--success)",
            boxShadow: "0 0 5px var(--success)",
          }}
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
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background: p.online ? "var(--success)" : "var(--muted)",
                boxShadow: p.online ? "0 0 5px var(--success)" : "none",
              }}
            />
            <span
              className="text-xs"
              style={{
                color: p.online ? "var(--foreground)" : "var(--muted)",
              }}
            >
              {p.nickname ?? shortId(p.sessionId)}
              {!p.online && (
                <span
                  className="ml-1 text-[10px]"
                  style={{ color: "var(--muted)" }}
                >
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
