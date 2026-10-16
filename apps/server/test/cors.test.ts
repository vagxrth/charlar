import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parseCorsOrigins } from "../src/config/env.js";
import { startTestServer, type TestServer } from "./helpers.js";

// vitest.config.ts allows http://localhost:3000 and https://charlar.example.test,
// plus preview origins matching https://charlar-[a-z0-9]{9}-team\.vercel\.app.

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

// The REST API and Socket.IO's polling handshake both apply the list.
const paths = ["/health", "/socket.io/?EIO=4&transport=polling"];

/** The Access-Control-Allow-Origin header a page on `origin` gets back. */
async function allowedOrigin(path: string, origin: string): Promise<string | null> {
  const res = await fetch(`${server.url}${path}`, { headers: { origin } });
  await res.arrayBuffer();
  return res.headers.get("access-control-allow-origin");
}

describe("cors", () => {
  it.each(paths)("allows every listed origin on %s", async (path) => {
    for (const origin of ["http://localhost:3000", "https://charlar.example.test"]) {
      expect(await allowedOrigin(path, origin)).toBe(origin);
    }
  });

  it.each(paths)("allows preview origins that match the pattern on %s", async (path) => {
    const preview = "https://charlar-9oggq6evv-team.vercel.app";
    expect(await allowedOrigin(path, preview)).toBe(preview);
  });

  it.each(paths)("leaves the header off for any other origin on %s", async (path) => {
    for (const origin of [
      "https://other.example.test",
      // The pattern has to match the whole origin, not just its start.
      "https://charlar-9oggq6evv-team.vercel.app.other.example.test",
      // Branch aliases don't fit the pattern.
      "https://charlar-git-main-team.vercel.app",
    ]) {
      expect(await allowedOrigin(path, origin)).toBeNull();
    }
  });
});

describe("parseCorsOrigins", () => {
  it("trims each origin and skips empty entries", () => {
    expect(parseCorsOrigins(" https://a.example.test ,, https://b.example.test,")).toEqual([
      "https://a.example.test",
      "https://b.example.test",
    ]);
  });

  it("names the variable when the pattern isn't a valid regular expression", () => {
    expect(() => parseCorsOrigins("https://a.example.test", "https://(")).toThrow(
      /CORS_ORIGIN_PATTERN/
    );
  });
});
