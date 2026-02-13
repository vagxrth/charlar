"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useRoom } from "../_lib/room-context";

/**
 * Verifies the user has an active room matching the URL params.
 * Redirects to home if the room context is empty or mismatched.
 */
export function RoomGuard({
  code,
  children,
}: {
  code: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { room } = useRoom();

  useEffect(() => {
    if (!room || room.code !== code) {
      router.replace("/");
    }
  }, [room, code, router]);

  if (!room || room.code !== code) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Redirecting...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
