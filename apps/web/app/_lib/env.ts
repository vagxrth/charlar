/** Client-safe env — only NEXT_PUBLIC_ vars are available in the browser. */
export const env = {
  serverUrl: process.env["NEXT_PUBLIC_SERVER_URL"] ?? "http://localhost:3001",
} as const;
