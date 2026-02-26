"use client";

export function TypingIndicator({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div className="px-5 pb-1 animate-fade-in">
      <span
        className="inline-flex items-center gap-1 text-xs"
        style={{ color: "var(--muted)" }}
      >
        <span className="inline-flex gap-[3px]">
          <span
            className="inline-block h-1 w-1 rounded-full animate-dot-bounce"
            style={{ background: "var(--accent)", animationDelay: "0ms" }}
          />
          <span
            className="inline-block h-1 w-1 rounded-full animate-dot-bounce"
            style={{ background: "var(--accent)", animationDelay: "0.2s" }}
          />
          <span
            className="inline-block h-1 w-1 rounded-full animate-dot-bounce"
            style={{ background: "var(--accent)", animationDelay: "0.4s" }}
          />
        </span>
        <span className="ml-1">typing</span>
      </span>
    </div>
  );
}
