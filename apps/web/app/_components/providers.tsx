"use client";

import type { ReactNode } from "react";
import { RoomProvider } from "../_lib/room-context";
import { SocketProvider } from "../_lib/socket-context";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SocketProvider>
      <RoomProvider>{children}</RoomProvider>
    </SocketProvider>
  );
}
