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
