"use client";

import { useRoom } from "../../../../_lib/room-context";
import { useSocket } from "../../../../_lib/socket-context";

function shortId(id: string): string {
  return id.slice(0, 8);
}

function Avatar({ name, online }: { name: string; online: boolean }) {
  const initial = name.charAt(0).toUpperCase() || "?";
  return (
    <span className="relative inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
      style={{
        background: online ? "var(--accent-soft)" : "var(--surface-hover)",
        color: online ? "var(--accent)" : "var(--muted)",
        border: "1px solid var(--border)",
      }}
    >
      {initial}
      <span
        className="absolute -bottom-0 -right-0 inline-block h-2 w-2 rounded-full"
        style={{
          background: online ? "var(--success)" : "var(--muted)",
          boxShadow: online ? "0 0 6px var(--success), 0 0 0 2px var(--surface)" : "0 0 0 2px var(--surface)",
        }}
      />
    </span>
  );
}

export function PresenceBar() {
  const { sessionId } = useSocket();
  const { room } = useRoom();

  if (!room) return null;

  const peers = room.participants.filter((p) => p.sessionId !== sessionId);

  return (
    <div
      className="flex items-center gap-4 px-5 py-2.5 animate-fade-in"
      style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-elevated)" }}
    >
      {/* Self */}
      <div className="flex items-center gap-2">
        <Avatar name={room.nickname ?? "You"} online />
        <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
          {room.nickname ?? "You"}
          <span className="ml-1" style={{ color: "var(--muted)" }}>(you)</span>
        </span>
      </div>

      <span className="h-3 w-px" style={{ background: "var(--border)" }} />

      {peers.length === 0 ? (
        <span className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full animate-pulse-soft" style={{ background: "var(--muted)" }} />
          </span>
          Waiting for someone to join…
        </span>
      ) : (
        peers.map((p) => (
          <div key={p.sessionId} className="flex items-center gap-2">
            <Avatar name={p.nickname ?? shortId(p.sessionId)} online={p.online} />
            <span
              className="text-xs"
              style={{
                color: p.online ? "var(--foreground)" : "var(--muted)",
                fontWeight: 500,
              }}
            >
              {p.nickname ?? shortId(p.sessionId)}
              {!p.online && (
                <span className="ml-1 font-normal" style={{ color: "var(--muted)" }}>
                  away
                </span>
              )}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
