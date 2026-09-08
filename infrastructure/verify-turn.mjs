#!/usr/bin/env node
/**
 * End-to-end check of the TURN relay path.
 *
 *   node infrastructure/verify-turn.mjs api.charlar.vagarth.in
 *   node infrastructure/verify-turn.mjs api.charlar.vagarth.in --ip 34.121.38.38
 *
 * Nothing else in the stack reports a broken relay. Signaling, chat and direct
 * P2P calls all keep working while coturn advertises a relay address that no
 * longer belongs to the host, so the only symptom is that the ~15-20% of calls
 * needing TURN fail with no error anywhere. This performs a real RFC 5766
 * Allocate using the credentials the app hands to browsers, then asserts that
 * the relay address coturn returns is actually this host.
 *
 * Exits 0 on success, 1 on failure, so it works as a cron or CI check.
 *
 * The allocation it opens is left to expire on its own after coturn's default
 * lifetime (600s), so avoid running this in a tight loop against a server with
 * a low total-quota.
 */
import dgram from "node:dgram";
import crypto from "node:crypto";
import { resolve4 } from "node:dns/promises";

const MAGIC = 0x2112a442;
const ALLOCATE = 0x0003;
const SUCCESS = 0x0103;
const CHALLENGE = 0x0113;

const ATTR = {
  USERNAME: 0x0006,
  MESSAGE_INTEGRITY: 0x0008,
  ERROR_CODE: 0x0009,
  REALM: 0x0014,
  NONCE: 0x0015,
  XOR_RELAYED_ADDRESS: 0x0016,
  REQUESTED_TRANSPORT: 0x0019,
  XOR_MAPPED_ADDRESS: 0x0020,
};

const ok = (m) => console.log(`  \x1b[32m✔\x1b[0m ${m}`);
const bad = (m) => console.log(`  \x1b[31m✘\x1b[0m ${m}`);
const info = (m) => console.log(`    ${m}`);

// ── STUN/TURN wire format ────────────────────────────────

function attr(type, value) {
  const padding = (4 - (value.length % 4)) % 4;
  const buf = Buffer.alloc(4 + value.length + padding);
  buf.writeUInt16BE(type, 0);
  buf.writeUInt16BE(value.length, 2);
  value.copy(buf, 4);
  return buf;
}

function message(type, transactionId, attrs) {
  const body = Buffer.concat(attrs);
  const header = Buffer.alloc(20);
  header.writeUInt16BE(type, 0);
  header.writeUInt16BE(body.length, 2);
  header.writeUInt32BE(MAGIC, 4);
  transactionId.copy(header, 8);
  return Buffer.concat([header, body]);
}

function parse(buf) {
  const attrs = {};
  const end = 20 + buf.readUInt16BE(2);
  let offset = 20;
  while (offset + 4 <= end && offset + 4 <= buf.length) {
    const type = buf.readUInt16BE(offset);
    const length = buf.readUInt16BE(offset + 2);
    attrs[type] = buf.subarray(offset + 4, offset + 4 + length);
    offset += 4 + length + ((4 - (length % 4)) % 4);
  }
  return { type: buf.readUInt16BE(0), attrs };
}

/** XOR-MAPPED-ADDRESS and friends obfuscate the address with the magic cookie. */
function decodeXorAddress(value) {
  const port = value.readUInt16BE(2) ^ (MAGIC >>> 16);
  const octets = [];
  for (let i = 0; i < 4; i++) {
    octets.push(value[4 + i] ^ ((MAGIC >>> (24 - 8 * i)) & 0xff));
  }
  return { ip: octets.join("."), port };
}

/**
 * Long-term credentials sign the message with HMAC-SHA1 over a key derived
 * from the credential triplet. The header length must already account for the
 * MESSAGE-INTEGRITY attribute that is about to be appended.
 */
function sign(type, transactionId, attrs, username, realm, password) {
  const key = crypto
    .createHash("md5")
    .update(`${username}:${realm}:${password}`)
    .digest();
  const partial = message(type, transactionId, attrs);
  partial.writeUInt16BE(partial.length - 20 + 24, 2);
  const integrity = crypto.createHmac("sha1", key).update(partial).digest();
  return Buffer.concat([partial, attr(ATTR.MESSAGE_INTEGRITY, integrity)]);
}

function errorText(attrs) {
  const e = attrs[ATTR.ERROR_CODE];
  if (!e) return "unknown error";
  return `${e[2] * 100 + e[3]} ${e.subarray(4).toString()}`;
}

// ── The check ────────────────────────────────────────────

/** Runs the Allocate handshake, returning the mapped and relayed addresses. */
function allocate({ host, port, username, credential }) {
  const socket = dgram.createSocket("udp4");
  const transactionId = crypto.randomBytes(12);
  const requestedTransport = attr(
    ATTR.REQUESTED_TRANSPORT,
    Buffer.from([17, 0, 0, 0]) // 17 = UDP
  );

  return new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`no reply from ${host}:${port} — UDP blocked or coturn down?`));
    }, 12_000);

    const finish = (fn, arg) => {
      clearTimeout(timer);
      fn(arg);
    };

    socket.on("error", (err) => finish(reject, err));

    socket.on("message", (buf) => {
      const msg = parse(buf);

      // First Allocate is always rejected with a realm and nonce to sign with.
      if (msg.type === CHALLENGE && msg.attrs[ATTR.NONCE]) {
        const realm = msg.attrs[ATTR.REALM].toString();
        const nonce = msg.attrs[ATTR.NONCE];
        const signed = sign(
          ALLOCATE,
          transactionId,
          [
            attr(ATTR.USERNAME, Buffer.from(username)),
            attr(ATTR.REALM, Buffer.from(realm)),
            attr(ATTR.NONCE, nonce),
            requestedTransport,
          ],
          username,
          realm,
          credential
        );
        socket.send(signed, port, host);
        return;
      }

      if (msg.type === SUCCESS) {
        const relayed = decodeXorAddress(msg.attrs[ATTR.XOR_RELAYED_ADDRESS]);
        const mapped = msg.attrs[ATTR.XOR_MAPPED_ADDRESS]
          ? decodeXorAddress(msg.attrs[ATTR.XOR_MAPPED_ADDRESS])
          : null;
        finish(resolvePromise, { relayed, mapped, socket, transactionId });
        return;
      }

      finish(reject, new Error(`allocate rejected: ${errorText(msg.attrs)}`));
    });

    socket.send(message(ALLOCATE, transactionId, [requestedTransport]), port, host);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const host = args.find((a) => !a.startsWith("--"));
  // --ip bypasses DNS for both the target and the assertion, so the check is
  // usable while an A record is still propagating.
  const ipFlag = args.indexOf("--ip");
  const pinnedIp = ipFlag === -1 ? null : args[ipFlag + 1];

  if (!host) {
    console.error("usage: node infrastructure/verify-turn.mjs <api-host> [--ip <addr>]");
    process.exit(1);
  }

  console.log(`\nVerifying TURN relay for ${host}\n`);

  // 1. Credentials, fetched exactly the way the browser fetches them.
  let iceServers;
  try {
    const res = await fetch(`https://${host}/api/ice-config`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    ({ iceServers } = await res.json());
    ok(`fetched /api/ice-config (${iceServers.length} ICE server entries)`);
  } catch (err) {
    bad(`could not fetch https://${host}/api/ice-config — ${err.message}`);
    process.exit(1);
  }

  const turn = iceServers.find((s) => [].concat(s.urls).some((u) => u.startsWith("turn:")));
  if (!turn) {
    bad("no turn: entry in the ICE config — TURN_URLS is unset on the server");
    process.exit(1);
  }

  const url = [].concat(turn.urls).find((u) => u.startsWith("turn:"));
  const [, hostPort] = url.split("turn:");
  const [turnHost, turnPortRaw] = hostPort.split("?")[0].split(":");
  const turnPort = Number(turnPortRaw ?? 3478);
  ok(`TURN endpoint ${turnHost}:${turnPort}`);

  if (/^\d+$/.test(turn.username)) {
    const expiresAt = new Date(Number(turn.username) * 1000);
    const hours = ((expiresAt - Date.now()) / 3_600_000).toFixed(1);
    info(`ephemeral credential expires ${expiresAt.toISOString()} (${hours}h)`);
  }

  // 2. Where the host actually lives, so we can check what coturn claims.
  let expected;
  if (pinnedIp) {
    expected = [pinnedIp];
    info(`using ${pinnedIp} instead of DNS (--ip)`);
  } else {
    try {
      expected = await resolve4(turnHost);
      ok(`${turnHost} resolves to ${expected.join(", ")}`);
    } catch (err) {
      bad(`could not resolve ${turnHost} — ${err.message}`);
      info("pass --ip <addr> to check the server while DNS is still propagating");
      process.exit(1);
    }
  }

  // 3. A real allocation — proves auth, the shared secret, and reachability.
  let result;
  try {
    result = await allocate({
      host: expected[0],
      port: turnPort,
      username: turn.username,
      credential: turn.credential,
    });
    ok("Allocate succeeded — HMAC credentials accepted by coturn");
  } catch (err) {
    bad(`allocate failed — ${err.message}`);
    info("a 401 here means TURN_SECRET differs between signaling.env and turn/.env");
    process.exit(1);
  }

  const { relayed, mapped, socket } = result;
  if (mapped) info(`your address as coturn sees it: ${mapped.ip}:${mapped.port}`);

  socket.close();

  // 4. The assertion that matters.
  console.log("");
  if (expected.includes(relayed.ip)) {
    ok(`relay address ${relayed.ip}:${relayed.port} matches the host\n`);
    process.exit(0);
  }

  bad(`relay address is ${relayed.ip}, but ${turnHost} is ${expected.join(", ")}`);
  info("coturn is telling peers to send media to an address that is not this host.");
  info("Relayed calls will fail silently. TURN_EXTERNAL_IP is stale — restart coturn:");
  info("  docker compose -f infrastructure/docker-compose.yml up -d --force-recreate coturn\n");
  process.exit(1);
}

main().catch((err) => {
  bad(err.message);
  process.exit(1);
});
