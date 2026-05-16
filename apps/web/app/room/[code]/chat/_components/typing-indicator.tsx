"use client";

export function TypingIndicator({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div className="px-5 pb-2 pt-1 animate-fade-in">
      <div
        className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          color: "var(--muted)",
        }}
      >
        <span className="inline-flex gap-[3px]">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full animate-dot-bounce"
            style={{ background: "var(--accent)", animationDelay: "0ms" }}
          />
          <span
            className="inline-block h-1.5 w-1.5 rounded-full animate-dot-bounce"
            style={{ background: "var(--accent)", animationDelay: "0.18s" }}
          />
          <span
            className="inline-block h-1.5 w-1.5 rounded-full animate-dot-bounce"
            style={{ background: "var(--accent)", animationDelay: "0.36s" }}
          />
        </span>
        <span
          className="text-[11px]"
          style={{
            color: "var(--foreground-secondary)",
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
          }}
        >
          typing
        </span>
      </div>
    </div>
  );
}
