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
    <div
      className="flex w-full max-w-sm flex-col gap-8 rounded-2xl p-8 animate-fade-in-up"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.03)",
        animationDelay: "0.1s",
      }}
    >
      {/* Nickname */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="nickname"
          className="text-[11px] font-medium uppercase tracking-wider"
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
          className="rounded-xl border px-4 py-3 text-sm outline-none transition-all duration-200 placeholder:text-sm disabled:opacity-50"
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
      </div>

      {/* Mode selection */}
      <div className="flex flex-col gap-2">
        <span
          className="text-[11px] font-medium uppercase tracking-wider"
          style={{ color: "var(--muted)" }}
        >
          Mode
        </span>
        <div className="grid grid-cols-2 gap-2">
          {(["chat", "video"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="flex flex-col items-center gap-2.5 rounded-xl border px-4 py-5 text-sm font-medium transition-all duration-200"
              style={{
                borderColor: mode === m ? "var(--accent)" : "var(--border)",
                background: mode === m ? "var(--accent-soft)" : "transparent",
                color: mode === m ? "var(--accent)" : "var(--muted)",
                boxShadow:
                  mode === m ? "0 0 0 1px var(--accent)" : "none",
              }}
            >
              {m === "chat" ? (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              ) : (
                <svg
                  width="24"
                  height="24"
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
              )}
              {m === "chat" ? "Chat" : "Video"}
            </button>
          ))}
        </div>
      </div>

      {/* Create room */}
      <button
        type="button"
        onClick={handleCreate}
        disabled={disabled}
        className="w-full rounded-xl px-4 py-3.5 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50"
        style={{
          background: "var(--accent)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.background = "var(--accent-hover)";
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow =
              "0 4px 12px rgba(0,0,0,0.1)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--accent)";
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.06)";
        }}
      >
        {loading ? "Connecting..." : "Create Room"}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="h-px flex-1" style={{ background: "var(--border)" }} />
        <span
          className="text-[11px] uppercase tracking-wider"
          style={{ color: "var(--muted)" }}
        >
          or join
        </span>
        <div className="h-px flex-1" style={{ background: "var(--border)" }} />
      </div>

      {/* Join room */}
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
            className="flex-1 rounded-xl border px-4 py-3 text-center font-mono text-lg tracking-[0.3em] outline-none transition-all duration-200 placeholder:tracking-[0.3em] disabled:opacity-50"
            style={{
              borderColor: error ? "var(--error)" : "var(--border)",
              background: "var(--background)",
              color: "var(--foreground)",
              boxShadow: error ? "0 0 0 3px var(--error-soft)" : "none",
            }}
            onFocus={(e) => {
              if (!error) {
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.boxShadow =
                  "0 0 0 3px var(--accent-soft)";
              }
            }}
            onBlur={(e) => {
              if (!error) {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.boxShadow = "none";
              }
            }}
          />
          <button
            type="submit"
            disabled={disabled}
            className="rounded-xl border px-6 py-3 text-sm font-semibold transition-all duration-200 disabled:opacity-50"
            style={{
              borderColor: "var(--border)",
              background: "transparent",
              color: "var(--foreground)",
            }}
            onMouseEnter={(e) => {
              if (!disabled) {
                e.currentTarget.style.background = "var(--surface-hover)";
                e.currentTarget.style.borderColor = "var(--accent)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "var(--border)";
            }}
          >
            Join
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
