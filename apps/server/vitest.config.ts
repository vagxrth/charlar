import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // A short reconnect window so sessions from finished tests expire quickly
    // instead of holding timers open; quiet logs.
    env: {
      RECONNECT_TIMEOUT_MS: "1000",
      LOG_LEVEL: "silent",
      // A STUN and a TURN server, so ICE config tests see both kinds.
      STUN_URLS: "stun:stun.example.test:3478",
      TURN_URLS: "turn:turn.example.test:3478",
      TURN_SECRET: "test-secret",
      // Two exact origins and a preview-deployment pattern, for the CORS tests.
      CORS_ORIGIN: "http://localhost:3000, https://charlar.example.test",
      CORS_ORIGIN_PATTERN: "https://charlar-[a-z0-9]{9}-team\\.vercel\\.app",
    },
    testTimeout: 15_000,
    hookTimeout: 20_000,
  },
});
