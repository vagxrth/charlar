"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { RoomGuard } from "../../../../_components/room-guard";
import { RoomHeader } from "../../../../_components/room-header";
import { useRoom } from "../../../../_lib/room-context";
import { useWebRTC } from "../_hooks/use-webrtc";
import { VideoControls } from "./video-controls";

const STATE_DOT: Record<string, string> = {
  idle: "rgba(255,255,255,0.4)",
  "acquiring-media": "var(--warning)",
  connecting: "var(--warning)",
  connected: "var(--success)",
  failed: "var(--error)",
};

const STATE_LABEL: Record<string, string> = {
  idle: "Waiting for peer",
  "acquiring-media": "Requesting media",
  connecting: "Connecting",
  connected: "Connected",
  failed: "Failed",
};

function MicOffIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .73-.11 1.43-.32 2.09" />
      <line x1="12" y1="19" x2="12" y2="23" />
    </svg>
  );
}

function VideoOffIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function ParticipantBadge({
  name,
  muted,
  align = "left",
}: {
  name: string;
  muted: boolean;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${align === "right" ? "flex-row-reverse" : ""}`}
      style={{
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(14px)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <span
        className="text-[12px] font-medium text-white"
        style={{ letterSpacing: "-0.005em" }}
      >
        {name}
      </span>
      {muted && (
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full text-white animate-fade-in"
          style={{
            background: "var(--error)",
            boxShadow: "0 0 0 2px rgba(0,0,0,0.4)",
          }}
          aria-label="Muted"
          title="Mic is muted"
        >
          <MicOffIcon size={11} />
        </span>
      )}
    </div>
  );
}

export function VideoRoom({ code }: { code: string }) {
  const router = useRouter();
  const { room, leaveRoom } = useRoom();
  const {
    localStream,
    remoteStream,
    connectionState,
    error,
    isAudioMuted,
    isVideoOff,
    remoteAudioMuted,
    remoteVideoOff,
    toggleAudio,
    toggleVideo,
  } = useWebRTC();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  function handleLeave() {
    leaveRoom();
    router.replace("/");
  }

  const remotePeer = room?.participants.find((p) => p.online);
  const remoteName = remotePeer?.nickname ?? "Peer";

  return (
    <RoomGuard code={code} mode="video">
      <div
        className="relative flex h-svh flex-col overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse at top, oklch(15% 0.012 75) 0%, oklch(8% 0.008 70) 100%)",
        }}
      >
        {/* Remote video — fills the stage */}
        <div className="relative flex-1 overflow-hidden">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              filter: remoteVideoOff ? "blur(28px) brightness(0.5)" : undefined,
              opacity: remoteVideoOff ? 0.35 : 1,
              transition: "filter .3s ease, opacity .3s ease",
            }}
          />

          {/* Subtle vignette over remote stream */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.45) 100%)",
            }}
            aria-hidden="true"
          />

          {/* Header (overlay) */}
          <div
            className="absolute inset-x-0 top-0 z-20"
            style={{
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)",
            }}
          >
            <RoomHeader overlay />
          </div>

          {/* Connection state indicator (top-right) */}
          <div
            className="absolute right-5 top-16 z-20 flex items-center gap-2 rounded-full px-3 py-1.5 animate-fade-in"
            style={{
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background: STATE_DOT[connectionState],
                boxShadow:
                  connectionState === "connected"
                    ? `0 0 8px ${STATE_DOT[connectionState]}`
                    : "none",
              }}
            />
            <span
              className="label-eyebrow"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              {STATE_LABEL[connectionState]}
            </span>
          </div>

          {/* Remote nickname + mute badge */}
          {remoteStream && (
            <div className="absolute bottom-6 left-6 z-20 animate-fade-in">
              <ParticipantBadge name={remoteName} muted={remoteAudioMuted} />
            </div>
          )}

          {/* Remote camera-off overlay — full-screen graceful state */}
          {remoteStream && remoteVideoOff && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 animate-fade-in">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full text-3xl font-semibold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, var(--accent) 0%, oklch(72% 0.10 175) 100%)",
                  boxShadow: "0 0 0 4px rgba(255,255,255,0.06)",
                  fontFamily: "var(--font-display)",
                }}
              >
                {remoteName.charAt(0).toUpperCase() || "·"}
              </div>
              <p
                className="text-sm"
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontFamily: "var(--font-display)",
                  fontStyle: "italic",
                }}
              >
                {remoteName}&rsquo;s camera is off
              </p>
            </div>
          )}

          {/* Empty state */}
          {!remoteStream && connectionState !== "failed" && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 animate-fade-in">
              <div
                className="relative flex h-20 w-20 items-center justify-center rounded-full animate-float-gentle"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {/* Outer breathing rings */}
                <span
                  className="absolute inset-0 rounded-full animate-pulse-soft"
                  style={{
                    border: "1px solid rgba(255,255,255,0.08)",
                    animationDelay: "0.4s",
                  }}
                />
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(255,255,255,0.4)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </div>
              <div className="text-center">
                <p
                  className="text-display text-xl"
                  style={{ color: "rgba(255,255,255,0.75)", fontStyle: "italic", fontWeight: 300 }}
                >
                  {connectionState === "acquiring-media"
                    ? "preparing your camera"
                    : "waiting for someone"}
                </p>
                <p
                  className="mt-2 label-eyebrow"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  share code {room?.code ?? code} to invite
                </p>
              </div>
            </div>
          )}

          {/* Error overlay */}
          {error && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 animate-fade-in">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: "var(--error-soft)" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p
                className="text-sm font-medium"
                style={{ color: "var(--error)" }}
              >
                {error}
              </p>
            </div>
          )}

          {/* Local PiP */}
          <div
            className="absolute bottom-6 right-6 z-30 overflow-hidden rounded-2xl transition-all duration-300"
            style={{
              width: 176,
              height: 132,
              background: "oklch(12% 0.01 70)",
              boxShadow:
                "0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
            }}
          >
            {/* The local <video> stays mounted across camera toggles so it
                keeps its srcObject — toggling video only flips track.enabled,
                it never recreates localStream, so the srcObject effect won't
                re-run to re-attach a freshly-mounted element. We layer the
                camera-off state on top instead (mirrors the remote video). */}
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
              style={{
                transform: "scaleX(-1)",
                opacity: isVideoOff ? 0 : 1,
                transition: "opacity .3s ease",
              }}
            />

            {isVideoOff && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-1 animate-fade-in"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(22% 0.02 75) 0%, oklch(15% 0.01 70) 100%)",
                }}
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--accent) 0%, oklch(72% 0.10 175) 100%)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {(room?.nickname ?? "Y").charAt(0).toUpperCase()}
                </span>
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                  camera off
                </span>
              </div>
            )}

            {/* Local nickname + mute */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1">
              <span
                className="rounded-md px-2 py-0.5 text-[10px] font-medium text-white"
                style={{
                  background: "rgba(0,0,0,0.55)",
                  backdropFilter: "blur(8px)",
                  maxWidth: 110,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {room?.nickname ?? "You"}
              </span>
              {isAudioMuted && (
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-white animate-fade-in"
                  style={{
                    background: "var(--error)",
                    boxShadow: "0 0 0 2px rgba(0,0,0,0.4)",
                  }}
                  aria-label="You are muted"
                >
                  <MicOffIcon size={10} />
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <VideoControls
          isAudioMuted={isAudioMuted}
          isVideoOff={isVideoOff}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onLeave={handleLeave}
        />

        {/* unused but keeps icons importable in case design changes */}
        <span className="sr-only">
          <VideoOffIcon />
        </span>
      </div>
    </RoomGuard>
  );
}
