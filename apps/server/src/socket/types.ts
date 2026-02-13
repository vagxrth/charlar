import type { Server, Socket } from "socket.io";

/**
 * Each domain module exports a handler that receives the io server
 * and the connected socket. This keeps handler registration uniform.
 */
export type SocketHandler = (io: Server, socket: Socket) => void;

/** Read the session ID that was attached during connection setup. */
export function getSessionId(socket: Socket): string {
  return socket.data.sessionId as string;
}

/** Ensure the callback is always callable — returns a no-op if the client omitted the ack. */
export function ensureCallback(cb: unknown): (res: unknown) => void {
  return typeof cb === "function" ? (cb as (res: unknown) => void) : () => {};
}
