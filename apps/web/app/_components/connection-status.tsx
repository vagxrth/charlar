"use client";

import { useSocket } from "../_lib/socket-context";

const labels: Record<string, string> = {
  connecting: "Connecting",
  connected: "Online",
  disconnected: "Reconnecting",
};

const dotColors: Record<string, string> = {
  connecting: "var(--warning)",
  connected: "var(--success)",
  disconnected: "var(--error)",
};

export function ConnectionStatus() {
  const { status } = useSocket();

  return (
    <div
      className="flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] animate-fade-in label-eyebrow"
      style={{
        background: "color-mix(in oklch, var(--surface) 70%, transparent)",
        border: "1px solid var(--border)",
        backdropFilter: "blur(12px)",
      }}
    >
      <span className="relative inline-flex h-1.5 w-1.5">
        <span
          className="absolute inset-0 rounded-full animate-pulse-soft"
          style={{
            background: dotColors[status],
            boxShadow:
              status === "connected" ? `0 0 8px ${dotColors[status]}` : "none",
          }}
        />
      </span>
      <span style={{ color: "var(--foreground-secondary)" }}>{labels[status]}</span>
    </div>
  );
}
