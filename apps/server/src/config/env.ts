import { env } from "node:process";

export const config = {
  port: Number(env["PORT"] ?? 3001),
  nodeEnv: env["NODE_ENV"] ?? "development",
  corsOrigin: env["CORS_ORIGIN"] ?? "http://localhost:3000",
  reconnectTimeoutMs: Number(env["RECONNECT_TIMEOUT_MS"] ?? 30_000),
  logLevel: env["LOG_LEVEL"] ?? (env["NODE_ENV"] === "production" ? "info" : "debug"),

  // ICE / TURN
  stunUrls: env["STUN_URLS"] ?? "",
  turnUrls: env["TURN_URLS"] ?? "",
  turnUsername: env["TURN_USERNAME"] ?? "",
  turnCredential: env["TURN_CREDENTIAL"] ?? "",
  turnSecret: env["TURN_SECRET"] ?? "",
  turnCredentialTtl: Number(env["TURN_CREDENTIAL_TTL"] ?? 86_400),
} as const;
