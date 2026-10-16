import { type AddressInfo } from "node:net";

import { io as ioClient, type Socket } from "socket.io-client";

import { createAppServer } from "../src/server.js";

export interface TestServer {
  url: string;
  close: () => Promise<void>;
}

/** Start the real server on an ephemeral port for one test file. */
export async function startTestServer(): Promise<TestServer> {
  const { server, io } = createAppServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        io.close(() => server.close(() => resolve()));
      }),
  };
}

let ipCounter = 1;

/** A client address no other test has used. */
export function nextIp(): string {
  return `198.51.100.${ipCounter++}`;
}

/**
 * Connect a client with a distinct X-Forwarded-For, so the per-IP connection
 * limit (60/min) doesn't bleed across clients. Safe only because no proxy sits
 * in front of the test server.
 */
export function connect(url: string, auth: Record<string, unknown> = {}): Socket {
  return ioClient(url, {
    forceNew: true,
    extraHeaders: { "x-forwarded-for": nextIp() },
    auth,
  });
}

/** Resolve with the session the server assigns on connect. */
export function sessionCreated(
  socket: Socket
): Promise<{ sessionId: string; resumeToken?: string; features?: string[] }> {
  return new Promise((resolve) => socket.once("session:created", resolve));
}

/** Emit an event and resolve with its acknowledgement (rejects on timeout). */
export function emit<T = { ok: boolean; [k: string]: unknown }>(
  socket: Socket,
  event: string,
  ...args: unknown[]
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ack for ${event}`)), 3_000);
    socket.emit(event, ...args, (res: T) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

/** Resolve with the next occurrence of an event, or null after `ms`. */
export function nextEvent<T = unknown>(
  socket: Socket,
  event: string,
  ms = 600
): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(null);
    }, ms);
    function handler(payload: T) {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    }
    socket.on(event, handler);
  });
}
