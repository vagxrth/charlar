"use client";

import { useSocket } from "../_lib/socket-context";

const labels: Record<string, string> = {
  connecting: "Connecting",
  connected: "Connected",
  disconnected: "Reconnecting",
};

const dotColors: Record<string, string> = {
  connecting: "var(--muted)",
  connected: "var(--success)",
  disconnected: "var(--error)",
};

export function ConnectionStatus() {
  const { status } = useSocket();

  return (
    <div
      className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs animate-fade-in"
      style={{
        color: "var(--muted)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{
          background: dotColors[status],
          boxShadow:
            status === "connected"
              ? "0 0 6px var(--success)"
              : "none",
        }}
      />
      {labels[status]}
    </div>
  );
}
