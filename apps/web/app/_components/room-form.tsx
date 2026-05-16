"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useRoom } from "../_lib/room-context";
import { useSocket } from "../_lib/socket-context";

type Mode = "chat" | "video";

const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_REGEX = /^\d{6}$/;

export function RoomForm() {
  const router = useRouter();
  const { status } = useSocket();
  const { createRoom, joinRoom } = useRoom();
  const [nickname, setNickname] = useState("");
  const [mode, setMode] = useState<Mode>("chat");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const disabled = status !== "connected" || loading;

  function handleCodeChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, ROOM_CODE_LENGTH);
    setCode(digits);
    if (error) setError("");
  }

  async function handleCreate() {
    if (disabled) return;
    setLoading(true);
    setError("");

    try {
      const roomCode = await createRoom(mode, nickname);
      router.push(`/room/${roomCode}/${mode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
      setLoading(false);
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (disabled) return;

    if (!ROOM_CODE_REGEX.test(code)) {
      setError("Enter a valid 6-digit code");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await joinRoom(code, mode, nickname);
      router.push(`/room/${code}/${mode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room");
      setLoading(false);
    }
  }

  return (
    <div
      className="surface-card flex w-full flex-col gap-7 p-7 animate-fade-in-up"
      style={{ animationDelay: ".4s" }}
    >
      {/* Nickname */}
      <div className="flex flex-col gap-2">
        <label htmlFor="nickname" className="label-eyebrow">
          Your name
        </label>
        <input
          id="nickname"
          type="text"
          autoComplete="off"
          placeholder="Guest"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          disabled={disabled}
          className="input-soft px-4 py-3 text-sm outline-none placeholder:text-[var(--muted)] disabled:opacity-50"
        />
      </div>

      {/* Mode toggle (segmented) */}
      <div className="flex flex-col gap-2">
        <span className="label-eyebrow">Mode</span>
        <div
          className="relative grid grid-cols-2 gap-1 rounded-xl p-1"
          style={{
            background: "var(--background)",
            border: "1px solid var(--border)",
          }}
        >
          {/* Sliding indicator */}
          <div
            className="absolute top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-lg transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)]"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--accent)",
              boxShadow: "0 1px 3px rgba(0,0,0,.05), 0 0 0 3px var(--accent-soft)",
              transform: mode === "chat" ? "translateX(0.25rem)" : "translateX(calc(100% + 0.5rem))",
            }}
            aria-hidden="true"
          />
          {(["chat", "video"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="relative z-10 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-200"
              style={{
                color: mode === m ? "var(--accent)" : "var(--muted)",
              }}
            >
              {m === "chat" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              )}
              <span>{m === "chat" ? "Chat" : "Video"}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Create */}
      <button
        type="button"
        onClick={handleCreate}
        disabled={disabled}
        className="btn-primary w-full"
      >
        {loading ? (
          <>
            <span className="inline-block h-2 w-2 rounded-full animate-pulse-soft" style={{ background: "currentColor" }} />
            Connecting…
          </>
        ) : (
          <>
            Open a new room
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </>
        )}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1" style={{ background: "var(--border)" }} />
        <span className="label-eyebrow">or join one</span>
        <div className="h-px flex-1" style={{ background: "var(--border)" }} />
      </div>

      {/* Join */}
      <form onSubmit={handleJoin} className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000000"
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            maxLength={ROOM_CODE_LENGTH}
            disabled={disabled}
            className="input-soft flex-1 px-4 py-3 text-center text-mono text-lg tracking-[0.42em] placeholder:tracking-[0.42em] placeholder:text-[var(--muted)] disabled:opacity-50"
            style={{
              borderColor: error ? "var(--error)" : undefined,
              boxShadow: error ? "0 0 0 4px var(--error-soft)" : undefined,
            }}
          />
          <button
            type="submit"
            disabled={disabled || code.length === 0}
            className="btn-ghost"
          >
            Join
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        {error && (
          <p
            className="animate-fade-in text-center text-xs"
            style={{ color: "var(--error)" }}
          >
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
