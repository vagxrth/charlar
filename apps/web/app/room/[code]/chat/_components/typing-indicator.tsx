"use client";

export function TypingIndicator({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div className="px-4 pb-1">
      <span className="text-xs" style={{ color: "var(--muted)" }}>
        <span className="inline-flex gap-0.5">
          <span className="animate-bounce [animation-delay:0ms]">.</span>
          <span className="animate-bounce [animation-delay:150ms]">.</span>
          <span className="animate-bounce [animation-delay:300ms]">.</span>
        </span>{" "}
        typing
      </span>
    </div>
  );
}
