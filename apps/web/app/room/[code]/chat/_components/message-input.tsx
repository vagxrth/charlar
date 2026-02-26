"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";

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

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 px-4 py-3"
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      <textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none rounded-xl border px-4 py-2.5 text-sm outline-none transition-all duration-200 placeholder:text-[var(--muted)] disabled:opacity-50"
        style={{
          borderColor: "var(--border)",
          background: "var(--background)",
          color: "var(--foreground)",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--accent)";
          e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-soft)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.boxShadow = "none";
        }}
      />
      <button
        type="submit"
        disabled={disabled || value.trim().length === 0}
        className="rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 disabled:opacity-40"
        style={{
          background: "var(--accent)",
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.background = "var(--accent-hover)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--accent)";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        Send
      </button>
    </form>
  );
}
