import { env } from "node:process";

/**
 * Origins allowed to call the API: a comma-separated list of exact origins,
 * plus an optional regular expression for origins that can't be listed ahead
 * of time, such as preview deployments. The pattern must match the whole
 * origin.
 */
export function parseCorsOrigins(list: string, pattern = ""): (string | RegExp)[] {
  const origins: (string | RegExp)[] = list
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const source = pattern.trim();
  if (source) {
    try {
      origins.push(new RegExp(`^(?:${source})$`));
    } catch (err) {
      throw new Error(
        `CORS_ORIGIN_PATTERN is not a valid regular expression: ${(err as Error).message}`
      );
    }
  }

  return origins;
}

// `||` rather than `??`: an empty value in .env (e.g. `LOG_LEVEL=`) means
// "use the default", not an empty setting.
export const config = {
  port: Number(env["PORT"] || 3001),
  nodeEnv: env["NODE_ENV"] || "development",
  corsOrigins: parseCorsOrigins(
    env["CORS_ORIGIN"] || "http://localhost:3000",
    env["CORS_ORIGIN_PATTERN"]
  ),
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
