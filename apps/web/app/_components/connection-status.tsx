"use client";

import { useSocket } from "../_lib/socket-context";

const labels: Record<string, string> = {
  connecting: "Connecting",
  connected: "Connected",
  disconnected: "Reconnecting",
};

const colors: Record<string, string> = {
  connecting: "var(--muted)",
  connected: "#22c55e",
  disconnected: "var(--error)",
};

export function ConnectionStatus() {
  const { status } = useSocket();

  return (
    <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: colors[status] }}
      />
      {labels[status]}
    </div>
  );
}
