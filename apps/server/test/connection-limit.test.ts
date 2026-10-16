import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { io as ioClient, type Socket } from "socket.io-client";

import { nextIp, startTestServer, type TestServer } from "./helpers.js";

// The server allows 60 new connections a minute from one address.
const LIMIT = 60;
const WINDOW_MS = 60_000;

type Attempt = { ok: true } | { ok: false; message: string; retryAfterMs?: unknown };

let server: TestServer;
const sockets: Socket[] = [];

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

afterEach(() => {
  vi.useRealTimers();
  for (const socket of sockets.splice(0)) socket.disconnect();
});

/** Connect from `ip` and resolve once the server accepts or refuses. */
function attempt(ip: string): Promise<Attempt> {
  // WebSocket only: dozens of polling clients upgrading at once in one process
  // sometimes hit a transport error, which Socket.IO retries but would read
  // as a refusal here.
  const socket = ioClient(server.url, {
    forceNew: true,
    transports: ["websocket"],
    extraHeaders: { "x-forwarded-for": ip },
  });
  sockets.push(socket);
  return new Promise((resolve) => {
    socket.once("session:created", () => resolve({ ok: true }));
    socket.once("connect_error", (err: Error & { data?: { retryAfterMs?: unknown } }) =>
      resolve({ ok: false, message: err.message, retryAfterMs: err.data?.retryAfterMs })
    );
  });
}

function attempts(ip: string, count: number): Promise<Attempt[]> {
  return Promise.all(Array.from({ length: count }, () => attempt(ip)));
}

describe("connection limit", () => {
  it("refuses an address over the limit and says when a slot frees up", async () => {
    // Only the clock is faked; timers and sockets run normally.
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.now();
    const ip = nextIp();

    expect((await attempts(ip, LIMIT)).every((r) => r.ok)).toBe(true);
    expect(await attempt(ip)).toEqual({
      ok: false,
      message: "Too many connections",
      retryAfterMs: WINDOW_MS,
    });

    // The wait is exact: still refused a millisecond early, let in on time.
    vi.setSystemTime(start + WINDOW_MS - 1);
    expect(await attempt(ip)).toMatchObject({ ok: false, retryAfterMs: 1 });

    // Refused attempts didn't count, so the whole budget is back, and the new
    // connections count against it in turn.
    vi.setSystemTime(start + WINDOW_MS);
    expect((await attempts(ip, LIMIT)).every((r) => r.ok)).toBe(true);
    expect(await attempt(ip)).toMatchObject({ ok: false, retryAfterMs: WINDOW_MS });
  });

  it("counts each address separately", async () => {
    const busy = nextIp();
    await attempts(busy, LIMIT);

    expect((await attempt(busy)).ok).toBe(false);
    expect((await attempt(nextIp())).ok).toBe(true);
  });
});
