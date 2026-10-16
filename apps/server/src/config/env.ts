import { env } from "node:process";

// `||` rather than `??`: an empty value in .env (e.g. `LOG_LEVEL=`) means
// "use the default", not an empty setting.
export const config = {
  port: Number(env["PORT"] || 3001),
  nodeEnv: env["NODE_ENV"] || "development",
  corsOrigin: env["CORS_ORIGIN"] || "http://localhost:3000",
  reconnectTimeoutMs: Number(env["RECONNECT_TIMEOUT_MS"] || 30_000),
  logLevel: env["LOG_LEVEL"] || (env["NODE_ENV"] === "production" ? "info" : "debug"),

  // ICE / TURN
  stunUrls: env["STUN_URLS"] ?? "",
  turnUrls: env["TURN_URLS"] ?? "",
  turnUsername: env["TURN_USERNAME"] ?? "",
  turnCredential: env["TURN_CREDENTIAL"] ?? "",
  turnSecret: env["TURN_SECRET"] ?? "",
  // 4 hours. Coturn won't refresh an allocation once its credential has
  // expired, so keep this above the longest relayed call you expect.
  turnCredentialTtl: Number(env["TURN_CREDENTIAL_TTL"] || 14_400),
} as const;
