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
      setError("Enter a valid 6-digit room code");
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
    <div className="flex w-full max-w-md flex-col gap-8">
      {/* ── Nickname ─────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="nickname"
          className="text-xs font-medium"
          style={{ color: "var(--muted)" }}
        >
          Nickname
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
          className="rounded-xl border px-4 py-3 text-sm outline-none transition-colors placeholder:text-sm disabled:opacity-50"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
            color: "var(--foreground)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        />
      </div>

      {/* ── Mode selection ──────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setMode("chat")}
          className="flex flex-col items-center gap-2 rounded-xl border px-4 py-5 text-sm font-medium transition-colors"
          style={{
            borderColor:
              mode === "chat" ? "var(--accent)" : "var(--border)",
            background:
              mode === "chat" ? "var(--surface-hover)" : "var(--surface)",
            color: mode === "chat" ? "var(--accent)" : "var(--muted)",
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Chat
        </button>

        <button
          type="button"
          onClick={() => setMode("video")}
          className="flex flex-col items-center gap-2 rounded-xl border px-4 py-5 text-sm font-medium transition-colors"
          style={{
            borderColor:
              mode === "video" ? "var(--accent)" : "var(--border)",
            background:
              mode === "video" ? "var(--surface-hover)" : "var(--surface)",
            color: mode === "video" ? "var(--accent)" : "var(--muted)",
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          Video
        </button>
      </div>

      {/* ── Create room ─────────────────────────────── */}
      <button
        type="button"
        onClick={handleCreate}
        disabled={disabled}
        className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-50"
        style={{ background: "var(--accent)" }}
        onMouseEnter={(e) => {
          if (!disabled)
            e.currentTarget.style.background = "var(--accent-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--accent)";
        }}
      >
        {loading ? "Connecting..." : "Create Room"}
      </button>

      {/* ── Divider ─────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1" style={{ background: "var(--border)" }} />
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          or join a room
        </span>
        <div className="h-px flex-1" style={{ background: "var(--border)" }} />
      </div>

      {/* ── Join room ───────────────────────────────── */}
      <form onSubmit={handleJoin} className="flex flex-col gap-3">
        <div className="flex gap-3">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000000"
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            maxLength={ROOM_CODE_LENGTH}
            disabled={disabled}
            className="flex-1 rounded-xl border px-4 py-3 text-center font-mono text-lg tracking-[0.3em] outline-none transition-colors placeholder:tracking-[0.3em] disabled:opacity-50"
            style={{
              borderColor: error ? "var(--error)" : "var(--border)",
              background: "var(--surface)",
              color: "var(--foreground)",
            }}
            onFocus={(e) => {
              if (!error)
                e.currentTarget.style.borderColor = "var(--accent)";
            }}
            onBlur={(e) => {
              if (!error)
                e.currentTarget.style.borderColor = "var(--border)";
            }}
          />
          <button
            type="submit"
            disabled={disabled}
            className="rounded-xl border px-6 py-3 text-sm font-semibold transition-colors disabled:opacity-50"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface)",
              color: "var(--foreground)",
            }}
            onMouseEnter={(e) => {
              if (!disabled)
                e.currentTarget.style.background = "var(--surface-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--surface)";
            }}
          >
            Join
          </button>
        </div>
        {error && (
          <p className="text-center text-xs" style={{ color: "var(--error)" }}>
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
