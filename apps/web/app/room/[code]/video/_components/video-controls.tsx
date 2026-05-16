"use client";

interface VideoControlsProps {
  isAudioMuted: boolean;
  isVideoOff: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onLeave: () => void;
}

function MicOnIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .73-.11 1.43-.32 2.09" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function VideoOnIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function VideoOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function HangupIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
      <line x1="23" y1="1" x2="1" y2="23" />
    </svg>
  );
}

function CtrlButton({
  active,
  onClick,
  variant = "default",
  ariaLabel,
  tooltip,
  children,
}: {
  active: boolean;
  onClick: () => void;
  variant?: "default" | "danger";
  ariaLabel: string;
  tooltip: string;
  children: React.ReactNode;
}) {
  const bg = variant === "danger"
    ? "var(--error)"
    : active
      ? "var(--error)"
      : "rgba(255,255,255,0.10)";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={tooltip}
      className="group relative flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200"
      style={{
        background: bg,
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow:
          variant === "danger"
            ? "0 4px 16px rgba(220,60,60,0.35)"
            : active
              ? "0 4px 16px rgba(220,60,60,0.25)"
              : "0 2px 8px rgba(0,0,0,0.25)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px) scale(1.04)";
        if (variant !== "danger" && !active) {
          e.currentTarget.style.background = "rgba(255,255,255,0.18)";
        }
        if (variant === "danger") {
          e.currentTarget.style.boxShadow = "0 6px 24px rgba(220,60,60,0.55)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0) scale(1)";
        e.currentTarget.style.background = bg;
        e.currentTarget.style.boxShadow =
          variant === "danger"
            ? "0 4px 16px rgba(220,60,60,0.35)"
            : active
              ? "0 4px 16px rgba(220,60,60,0.25)"
              : "0 2px 8px rgba(0,0,0,0.25)";
      }}
    >
      {children}
    </button>
  );
}

export function VideoControls({
  isAudioMuted,
  isVideoOff,
  onToggleAudio,
  onToggleVideo,
  onLeave,
}: VideoControlsProps) {
  return (
    <div
      className="relative z-30 flex items-center justify-center gap-3 px-5 pb-6 pt-5 animate-fade-in"
      style={{
        background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)",
        animationDelay: "0.2s",
      }}
    >
      <div
        className="flex items-center gap-2 rounded-full p-2"
        style={{
          background: "rgba(20,20,20,0.55)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
        }}
      >
        <CtrlButton
          active={isAudioMuted}
          onClick={onToggleAudio}
          ariaLabel={isAudioMuted ? "Unmute microphone" : "Mute microphone"}
          tooltip={isAudioMuted ? "Unmute" : "Mute"}
        >
          {isAudioMuted ? <MicOffIcon /> : <MicOnIcon />}
        </CtrlButton>

        <CtrlButton
          active={isVideoOff}
          onClick={onToggleVideo}
          ariaLabel={isVideoOff ? "Turn on camera" : "Turn off camera"}
          tooltip={isVideoOff ? "Start video" : "Stop video"}
        >
          {isVideoOff ? <VideoOffIcon /> : <VideoOnIcon />}
        </CtrlButton>

        <span className="mx-1 h-7 w-px" style={{ background: "rgba(255,255,255,0.08)" }} />

        <CtrlButton
          active={false}
          variant="danger"
          onClick={onLeave}
          ariaLabel="Leave call"
          tooltip="Leave call"
        >
          <HangupIcon />
        </CtrlButton>
      </div>
    </div>
  );
}
