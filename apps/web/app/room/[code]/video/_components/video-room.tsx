"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { RoomGuard } from "../../../../_components/room-guard";
import { useRoom } from "../../../../_lib/room-context";
import { useWebRTC } from "../_hooks/use-webrtc";
import { VideoControls } from "./video-controls";

const STATE_DOT: Record<string, string> = {
  idle: "var(--muted)",
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

  return (
    <RoomGuard code={code}>
      <div
        className="relative h-svh overflow-hidden"
        style={{ background: "oklch(10% 0.01 70)" }}
      >
        {/* Remote video */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Remote nickname */}
        {remoteStream && room?.participants.find((p) => p.sessionId !== undefined) && (
          <div
            className="absolute bottom-24 left-4 z-10 rounded-lg px-3 py-1.5"
            style={{
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(12px)",
            }}
          >
            <span className="text-xs font-medium text-white">
              {room.participants.find((p) => p.online)?.nickname ?? "Peer"}
            </span>
          </div>
        )}

        {/* Top overlay */}
        <div
          className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 pb-12 pt-5 animate-fade-in"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 100%)",
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white font-[family-name:var(--font-display)]">
              {room?.code ?? code}
            </span>
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              style={{
                background: "rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.7)",
                backdropFilter: "blur(8px)",
              }}
            >
              video
            </span>
            {room && (
              <span
                className="text-xs"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                {room.participantCount}{" "}
                {room.participantCount === 1 ? "participant" : "participants"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background: STATE_DOT[connectionState],
                boxShadow:
                  connectionState === "connected"
                    ? "0 0 6px var(--success)"
                    : "none",
              }}
            />
            <span
              className="text-xs"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              {STATE_LABEL[connectionState]}
            </span>
          </div>
        </div>

        {/* Empty state */}
        {!remoteStream && connectionState !== "failed" && (
          <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3 animate-fade-in">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full animate-breathe"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
            <p
              className="text-sm font-medium"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              {connectionState === "acquiring-media"
                ? "Requesting camera & mic..."
                : "Waiting for someone to join..."}
            </p>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-2 animate-fade-in">
            <p
              className="text-sm font-medium"
              style={{ color: "var(--error)" }}
            >
              {error}
            </p>
          </div>
        )}

        {/* Local video PiP */}
        <div
          className="absolute bottom-24 right-4 z-20 overflow-hidden rounded-2xl transition-all duration-300"
          style={{
            width: 160,
            height: 120,
            background: "oklch(15% 0.01 70)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            border: "2px solid rgba(255,255,255,0.08)",
          }}
        >
          {isVideoOff ? (
            <div className="flex h-full w-full items-center justify-center">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            </div>
          ) : (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
          )}
          {/* Local nickname */}
          <div
            className="absolute bottom-1.5 left-1.5 rounded-md px-2 py-0.5"
            style={{
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(8px)",
            }}
          >
            <span className="text-[10px] font-medium text-white">
              {room?.nickname ?? "You"}
            </span>
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
      </div>
    </RoomGuard>
  );
}
