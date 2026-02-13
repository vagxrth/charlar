# Coturn TURN Server

TURN relay for charlar — used when peer-to-peer WebRTC connections cannot be established directly.

## Quick start

```bash
cd infrastructure/turn
cp .env.example .env
# Fill in TURN_SECRET (must match apps/server), TURN_EXTERNAL_IP, etc.
docker compose up
```

## Integration with charlar backend

The backend's `IceConfigService` generates ephemeral HMAC-SHA1 credentials that coturn validates via the shared secret.

1. Set `TURN_SECRET` identically in both `apps/server/.env` and `infrastructure/turn/.env`
2. Set `TURN_URLS` in `apps/server/.env` to `turn:<your-server>:3478,turns:<your-server>:5349`
3. Credentials are generated per-request and auto-expire (default 24 h)

## Security recommendations

- **Use TURNS (TLS on port 5349) in production** — prevents eavesdropping on relay traffic
- **Use ephemeral credentials** (TURN_SECRET) not static — credentials auto-expire
- **RFC 1918 relay blocking** is already configured — prevents using TURN as a network pivot into internal infrastructure
- **Firewall**: only expose ports 3478, 5349, and the relay range (49152–65535/udp)
- **Rotate TURN_SECRET periodically** — update backend env simultaneously and restart both services
- **Run behind a reverse proxy** for TLS termination, or use coturn's native TLS with your own certs

## Bandwidth considerations

- Each relayed video call uses ~1.5–4 Mbps bidirectional (720p)
- The 16k relay port range (49152–65535) supports ~8k concurrent sessions
- `total-quota` in `turnserver.conf` limits aggregate bandwidth — size to your server's NIC capacity
- TURN is only used when direct P2P fails (~15–20% of connections); most traffic is peer-to-peer
- Monitor with coturn's Prometheus exporter or log-based metrics
- Watch bandwidth billing on cloud providers (AWS, GCP charge per-GB egress)

## Files

| File | Purpose |
|---|---|
| `turnserver.conf` | Coturn config template with `${ENV_VAR}` placeholders |
| `.env.example` | All required environment variables with documentation |
| `Dockerfile` | Container image — substitutes env vars at runtime via `envsubst` |
| `docker-compose.yml` | Development compose file with host networking |
