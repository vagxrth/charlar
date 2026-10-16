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
    },
    testTimeout: 15_000,
    hookTimeout: 20_000,
  },
});
