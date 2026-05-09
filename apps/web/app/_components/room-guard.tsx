"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useRoom, type Mode } from "../_lib/room-context";
import { useSocket } from "../_lib/socket-context";

/**
 * Verifies the user has an active room matching the URL params.
 * Restores room state after reload, then redirects if membership is invalid.
 */
export function RoomGuard({
  code,
  mode,
  children,
}: {
  code: string;
  mode: Mode;
  children: ReactNode;
}) {
  const router = useRouter();
  const { status } = useSocket();
  const { room, restoreRoom } = useRoom();
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (room?.code === code && room.mode === mode) {
      setRestoring(false);
      return;
    }

    if (status !== "connected") {
      setRestoring(true);
      return;
    }

    setRestoring(true);
    restoreRoom(code, mode).then((restored) => {
      if (cancelled) return;
      if (restored) {
        setRestoring(false);
      } else {
        router.replace("/");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [room?.code, room?.mode, code, mode, status, restoreRoom, router]);

  if (restoring || room?.code !== code || room.mode !== mode) {
    return (
      <div className="flex min-h-svh items-center justify-center animate-fade-in">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {status === "connected" ? "Restoring room..." : "Connecting..."}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
