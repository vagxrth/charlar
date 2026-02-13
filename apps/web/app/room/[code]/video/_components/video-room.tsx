"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { RoomGuard } from "../../../../_components/room-guard";
import { useRoom } from "../../../../_lib/room-context";
import { useWebRTC } from "../_hooks/use-webrtc";
import { VideoControls } from "./video-controls";

const STATE_DOT: Record<string, string> = {
  idle: "var(--muted)",
  "acquiring-media": "#f59e0b",
  connecting: "#f59e0b",
  connected: "#22c55e",
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
        style={{ background: "#000" }}
      >
        {/* Remote video — fills viewport */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Top overlay bar */}
        <div
          className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pb-12 pt-4"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)",
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">
              {room?.code ?? code}
            </span>
            <span
              className="rounded-md px-2 py-0.5 text-xs font-medium"
              style={{
                background: "rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.7)",
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
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: STATE_DOT[connectionState] }}
            />
            <span
              className="text-xs"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              {STATE_LABEL[connectionState]}
            </span>
          </div>
        </div>

        {/* Empty state — no remote stream yet */}
        {!remoteStream && connectionState !== "failed" && (
          <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-2">
            <div
              className="h-16 w-16 rounded-full"
              style={{ background: "rgba(255,255,255,0.08)" }}
            />
            <p
              className="text-sm font-medium"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              {connectionState === "acquiring-media"
                ? "Requesting camera & mic..."
                : "Waiting for someone to join..."}
            </p>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-2">
            <p className="text-sm font-medium" style={{ color: "var(--error)" }}>
              {error}
            </p>
          </div>
        )}

        {/* Local video PiP */}
        <div
          className="absolute bottom-24 right-4 z-20 overflow-hidden rounded-xl"
          style={{
            width: 160,
            height: 120,
            background: "#1a1a1a",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}
        >
          {isVideoOff ? (
            <div className="flex h-full w-full items-center justify-center">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="2"
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
        </div>

        {/* Bottom controls */}
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
