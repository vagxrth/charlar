"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

export function MessageInput({
  onSend,
  onTyping,
  disabled,
}: {
  onSend: (content: string) => void;
  onTyping: () => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea up to a sane max
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [value]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  }

  function handleChange(text: string) {
    setValue(text);
    if (text.trim().length > 0) {
      onTyping();
    }
  }

  const canSend = !disabled && value.trim().length > 0;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-3 px-4 py-3"
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--surface-elevated)",
      }}
    >
      <div
        className="input-soft flex flex-1 items-end gap-2 px-3 py-2"
        style={{ borderRadius: 16 }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write something kind…"
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-[var(--muted)] disabled:opacity-50"
          style={{
            color: "var(--foreground)",
            lineHeight: 1.45,
          }}
        />
        <span
          className="hidden self-center pb-1 pr-1 text-mono text-[10px] sm:inline"
          style={{ color: "var(--muted)", opacity: value.length > 0 ? 1 : 0, transition: "opacity .2s" }}
        >
          ↵
        </span>
      </div>
      <button
        type="submit"
        disabled={!canSend}
        className="btn-primary"
        style={{
          padding: "0.7rem 1rem",
          opacity: canSend ? 1 : 0.45,
        }}
        aria-label="Send message"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 2L11 13" />
          <path d="M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
      </button>
    </form>
  );
}
