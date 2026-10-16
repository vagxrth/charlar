import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // A short reconnect window so sessions from finished tests expire quickly
    // instead of holding timers open; quiet logs.
    env: { RECONNECT_TIMEOUT_MS: "1000", LOG_LEVEL: "silent" },
    testTimeout: 15_000,
    hookTimeout: 20_000,
  },
});
