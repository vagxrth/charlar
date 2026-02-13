import { createHmac } from "node:crypto";

export interface IceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

interface IceConfigOptions {
  stunUrls: string;
  turnUrls: string;
  turnUsername: string;
  turnCredential: string;
  turnSecret: string;
  turnCredentialTtl: number;
}

export class IceConfigService {
  private readonly stunUrls: string[];
  private readonly turnUrls: string[];
  private readonly turnUsername: string;
  private readonly turnCredential: string;
  private readonly turnSecret: string;
  private readonly turnCredentialTtl: number;

  constructor(opts: IceConfigOptions) {
    this.stunUrls = parseUrls(opts.stunUrls);
    this.turnUrls = parseUrls(opts.turnUrls);
    this.turnUsername = opts.turnUsername;
    this.turnCredential = opts.turnCredential;
    this.turnSecret = opts.turnSecret;
    this.turnCredentialTtl = opts.turnCredentialTtl;
  }

  /**
   * Build the ICE server list the client passes to RTCPeerConnection.
   *
   * TURN credential strategy:
   *  1. If TURN_SECRET is set → generate short-lived HMAC credentials
   *     (compatible with coturn's TURN REST API).
   *  2. Else if TURN_USERNAME + TURN_CREDENTIAL are set → use static creds.
   *  3. Else → TURN entry is omitted entirely (STUN only).
   */
  getIceServers(): IceServer[] {
    const servers: IceServer[] = [];

    if (this.stunUrls.length > 0) {
      servers.push({ urls: this.stunUrls });
    }

    if (this.turnUrls.length > 0) {
      if (this.turnSecret) {
        const { username, credential } = this.generateEphemeralCredentials();
        servers.push({
          urls: this.turnUrls,
          username,
          credential,
        });
      } else if (this.turnUsername && this.turnCredential) {
        servers.push({
          urls: this.turnUrls,
          username: this.turnUsername,
          credential: this.turnCredential,
        });
      }
    }

    return servers;
  }

  // ── private ────────────────────────────────────────────────

  /**
   * TURN REST API ephemeral credentials.
   *
   * username = "<expiry-unix-timestamp>"
   * credential = Base64( HMAC-SHA1( secret, username ) )
   *
   * The TURN server (e.g. coturn) shares the same secret and
   * validates that the timestamp hasn't expired.
   */
  private generateEphemeralCredentials(): {
    username: string;
    credential: string;
  } {
    const expiry = Math.floor(Date.now() / 1000) + this.turnCredentialTtl;
    const username = String(expiry);
    const credential = createHmac("sha1", this.turnSecret)
      .update(username)
      .digest("base64");

    return { username, credential };
  }
}

/** Split a comma-separated URL string, trimming whitespace and dropping empties. */
function parseUrls(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
