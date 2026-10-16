import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Socket } from "socket.io-client";

import {
  connect,
  emit,
  nextEvent,
  sessionCreated,
  startTestServer,
  type TestServer,
} from "./helpers.js";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let server: TestServer;
const sockets: Socket[] = [];

/** Connect a client that gets cleaned up after the test. */
function mk(auth: Record<string, unknown> = {}): Socket {
  const socket = connect(server.url, auth);
  sockets.push(socket);
  return socket;
}

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

afterEach(() => {
  for (const socket of sockets.splice(0)) socket.disconnect();
});

describe("rooms", () => {
  it("rejects room:leave from a non-member and tells no one", async () => {
    const a = mk();
    const b = mk();
    await Promise.all([sessionCreated(a), sessionCreated(b)]);

    const { code } = await emit<{ code: string }>(a, "room:create", "Alice");
    await emit(b, "room:join", code, "Bob");

    // An outsider who never joined tries to announce a departure.
    const outsider = mk();
    await sessionCreated(outsider);

    const peerLeft = nextEvent(a, "room:peer-left");
    const res = await emit<{ ok: boolean; error?: string }>(
      outsider,
      "room:leave",
      code
    );

    expect(res.ok).toBe(false);
    expect(await peerLeft).toBeNull();
  });

  it("tells the peer when a real member leaves", async () => {
    const a = mk();
    const b = mk();
    const [, sb] = await Promise.all([sessionCreated(a), sessionCreated(b)]);

    const { code } = await emit<{ code: string }>(a, "room:create", "Alice");
    await emit(b, "room:join", code, "Bob");

    const peerLeft = nextEvent<{ sessionId: string }>(a, "room:peer-left");
    await emit(b, "room:leave", code);

    expect((await peerLeft)?.sessionId).toBe(sb.sessionId);
  });

  it("keeps a nickname when its owner rejoins under it", async () => {
    const a = mk();
    const b = mk();
    await Promise.all([sessionCreated(a), sessionCreated(b)]);

    const first = await emit<{ code: string }>(a, "room:create", "Alice");
    await emit(a, "room:leave", first.code);

    const second = await emit<{ code: string }>(b, "room:create", "Bob");
    const join = await emit<{ nickname: string }>(a, "room:join", second.code, "Alice");

    expect(join.nickname).toBe("Alice");
  });
});

describe("signaling", () => {
  it("delivers a burst of ICE candidates without dropping any", async () => {
    const a = mk();
    const b = mk();
    const [sa, sb] = await Promise.all([sessionCreated(a), sessionCreated(b)]);

    const { code } = await emit<{ code: string }>(a, "room:create", "Alice");
    await emit(b, "room:join", code, "Bob");

    const BURST = 30;
    let received = 0;
    b.on("signal:ice-candidate", () => {
      received += 1;
    });

    const candidate = (i: number) => ({
      roomCode: code,
      targetSessionId: sb.sessionId,
      candidate: {
        candidate: `candidate:${i} 1 udp 2122260223 192.0.2.${i} 50000 typ host`,
        sdpMid: "0",
        sdpMLineIndex: 0,
      },
    });

    const acks = await Promise.all(
      Array.from({ length: BURST }, (_, i) =>
        emit<{ ok: boolean }>(a, "signal:ice-candidate", candidate(i))
      )
    );
    await sleep(400);

    expect(sa.sessionId).not.toBe(sb.sessionId);
    expect(acks.filter((r) => r.ok)).toHaveLength(BURST);
    expect(received).toBe(BURST);
  });
});

describe("sessions", () => {
  it("hands a session back to the client that holds its resume token", async () => {
    const first = mk();
    const original = await sessionCreated(first);
    expect(original.resumeToken).toBeTruthy();

    first.disconnect();
    await sleep(100); // let the server register the disconnect

    const resumed = mk({
      sessionId: original.sessionId,
      resumeToken: original.resumeToken,
    });
    const back = await sessionCreated(resumed);
    expect(back.sessionId).toBe(original.sessionId);
  });

  it("gives separate tabs separate sessions", async () => {
    const tab1 = mk();
    const tab2 = mk();
    const [s1, s2] = await Promise.all([sessionCreated(tab1), sessionCreated(tab2)]);

    expect(s1.sessionId).not.toBe(s2.sessionId);

    // Both can be in the same room at once, and both stay connected.
    const { code } = await emit<{ code: string }>(tab1, "room:create", "Alice");
    const join = await emit<{ ok: boolean }>(tab2, "room:join", code, "Bob");

    expect(join.ok).toBe(true);
    expect(tab1.connected).toBe(true);
    expect(tab2.connected).toBe(true);
  });
});

describe("room mode", () => {
  it("announces room-mode support when a client connects", async () => {
    const a = mk();
    const s = await sessionCreated(a);
    expect(s.features).toContain("room-mode");
  });

  it("keeps the creator's mode and hands it to joiners and presence", async () => {
    const a = mk();
    const b = mk();
    await Promise.all([sessionCreated(a), sessionCreated(b)]);

    const created = await emit<{ code: string; mode: string }>(
      a,
      "room:create",
      "Alice",
      "video"
    );
    expect(created.mode).toBe("video");

    const join = await emit<{ ok: boolean; mode: string }>(
      b,
      "room:join",
      created.code,
      "Bob"
    );
    expect(join.ok).toBe(true);
    expect(join.mode).toBe("video");

    const presence = await emit<{ mode: string }>(b, "presence:request", created.code);
    expect(presence.mode).toBe("video");
  });

  it("leaves the mode unknown when an older client doesn't send one", async () => {
    const a = mk();
    const b = mk();
    await Promise.all([sessionCreated(a), sessionCreated(b)]);

    // The pre-room-mode call shape: (nickname, callback).
    const created = await emit<{ ok: boolean; code: string; mode: string | null }>(
      a,
      "room:create",
      "Alice"
    );
    expect(created.ok).toBe(true);
    expect(created.mode).toBeNull();

    const join = await emit<{ ok: boolean; mode: string | null }>(
      b,
      "room:join",
      created.code,
      "Bob"
    );
    expect(join.ok).toBe(true);
    expect(join.mode).toBeNull();
  });
});
