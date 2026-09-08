"use client";

import { useSocket, type Status } from "../_lib/socket-context";

const labels: Record<Status, string> = {
  connecting: "connecting",
  connected: "online",
  disconnected: "reconnecting",
  unreachable: "server unreachable",
};

const dotColors: Record<Status, string> = {
  connecting: "var(--warning)",
  connected: "var(--success)",
  disconnected: "var(--error)",
  unreachable: "var(--error)",
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
          style={{ background: dotColors[status] }}
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
