"use client";

import { useSocket } from "../_lib/socket-context";

const labels: Record<string, string> = {
  connecting: "connecting",
  connected: "online",
  disconnected: "reconnecting",
};

const dotColors: Record<string, string> = {
  connecting: "var(--warning)",
  connected: "var(--success)",
  disconnected: "var(--error)",
};

/**
 * Connection heartbeat — lives in the form card's status bar, above the rule.
 * Ambient when healthy; takes the state color when the connection degrades
 * (the form's CTA escalates to "Connecting…" alongside it).
 */
export function ConnectionStatus() {
  const { status } = useSocket();
  const ok = status === "connected";

  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <span className="relative inline-flex h-1.5 w-1.5">
        <span
          className="absolute inset-0 rounded-full animate-pulse-soft"
          style={{
            background: dotColors[status],
            boxShadow: ok ? `0 0 8px ${dotColors[status]}` : "none",
          }}
        />
      </span>
      <span
        className="label-eyebrow"
        style={{
          color: ok ? "var(--muted)" : dotColors[status],
          opacity: ok ? 0.75 : 1,
        }}
      >
        {labels[status]}
      </span>
    </div>
  );
}
