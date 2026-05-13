# Charlar

Peer-to-peer video and text chat application built with WebRTC, Socket.IO, and Next.js. Create a room, share the code, and start chatting or video calling directly in the browser with no account required.

## Features

- **Text chat** with real-time message delivery, typing indicators, and presence awareness
- **Video calling** with peer-to-peer WebRTC connections
- **Room system** with 6-digit codes for easy sharing (max 2 participants per room)
- **Session persistence** with 30-second reconnection grace period
- **ICE restart** for automatic recovery from network disruptions
- **Ephemeral TURN credentials** via HMAC-SHA1 (never exposes raw secrets to clients)
- **Rate limiting** at every layer: HTTP, WebSocket connections, socket events, chat messages, and room join attempts

## Tech Stack

### Frontend (`apps/web`)

| Technology | Purpose |
|---|---|
| Next.js 16 | App Router, server components, file-based routing |
| React 19 | UI rendering |
| Tailwind CSS 4 | Styling with CSS custom properties (light/dark mode) |
| Socket.IO Client | WebSocket connection to signaling server |
| WebRTC (browser API) | Peer-to-peer audio/video streams |

### Backend (`apps/server`)

| Technology | Purpose |
|---|---|
| Node.js 22 | Runtime |
| Express 5 | HTTP server, REST endpoints (`/health`, `/api/ice-config`) |
| Socket.IO 4 | WebSocket signaling for rooms, chat, presence, and WebRTC |
| Helmet | HTTP security headers |
| express-rate-limit | API rate limiting |
| Pino | Structured JSON logging |

### Infrastructure

| Technology | Purpose |
|---|---|
| Coturn | TURN relay server for WebRTC NAT traversal |
| Docker + Docker Compose | TURN server containerisation |
| Google STUN servers | Public STUN for peer IP discovery |

### Deployment

| Platform | Service |
|---|---|
| Google Cloud (e2-micro VM) | Signaling server + TURN server + Caddy reverse proxy |
| Vercel | Frontend hosting |
| Caddy | Automatic HTTPS via Let's Encrypt |

### Monorepo Tooling

| Technology | Purpose |
|---|---|
| Turborepo | Build system with dependency-aware task pipelines |
| pnpm workspaces | Package management |
| TypeScript 5 | Type safety across all packages |
| ESLint 9 | Linting with flat config |
| Prettier | Code formatting |

## Architecture

```
Browser A                     Browser B
    │                             │
    │  Socket.IO (WebSocket)      │  Socket.IO (WebSocket)
    │                             │
    └──────────┐     ┌────────────┘
               ▼     ▼
         ┌─────────────────┐
         │  Signaling Server │  ← GCP VM (behind Caddy / HTTPS)
         │  (Express + S.IO) │
         └─────────────────┘
               │     │
    ┌──────────┘     └────────────┐
    ▼                             ▼
Browser A ◄── WebRTC P2P ───► Browser B
    │                             │
    │  (fallback when P2P fails)  │
    │                             │
    └──────────┐     ┌────────────┘
               ▼     ▼
         ┌─────────────────┐
         │   TURN Server    │  ← Same GCP VM (host networking)
         │   (Coturn)       │
         └─────────────────┘
```

1. Both peers connect to the signaling server via Socket.IO
2. Room creation/joining is handled through socket events
3. WebRTC offer/answer/ICE candidates are relayed through the signaling server
4. Media flows directly peer-to-peer (STUN helps discover public IPs)
5. If direct connection fails (~15-20% of cases), traffic is relayed through the TURN server

## Project Structure

```
charlar/
├── apps/
│   ├── server/                 # Express + Socket.IO signaling backend
│   │   ├── src/
│   │   │   ├── index.ts        # Entry point, graceful shutdown
│   │   │   ├── app.ts          # Express app, routes, middleware
│   │   │   ├── config/env.ts   # Environment variable config
│   │   │   ├── logger.ts       # Pino logger setup
│   │   │   ├── socket/
│   │   │   │   ├── index.ts    # Socket.IO init, session management, rate limiting
│   │   │   │   ├── types.ts    # Shared socket types
│   │   │   │   └── handlers/
│   │   │   │       ├── rooms.ts      # room:create, room:join, room:leave
│   │   │   │       ├── chat.ts       # chat:message, typing:start, typing:stop
│   │   │   │       ├── presence.ts   # presence:request
│   │   │   │       └── signaling.ts  # signal:offer, signal:answer, signal:ice-candidate
│   │   │   └── services/
│   │   │       ├── index.ts            # Singleton wiring
│   │   │       ├── room-service.ts     # Room CRUD, 6-digit codes, max 2 participants
│   │   │       ├── session-service.ts  # UUID sessions, reconnection grace period
│   │   │       ├── chat-service.ts     # Message validation, throttling
│   │   │       ├── typing-service.ts   # Typing state with auto-expiry
│   │   │       ├── presence-service.ts # Online/offline participant info
│   │   │       └── ice-config-service.ts # STUN/TURN config, HMAC credential generation
│   │   └── Dockerfile          # Multi-stage production build
│   │
│   └── web/                    # Next.js 16 App Router frontend
│       └── app/
│           ├── layout.tsx      # Root layout (Outfit + Jakarta Sans fonts)
│           ├── page.tsx        # Home page (connection status, room form)
│           ├── globals.css     # CSS custom properties, light/dark theme
│           ├── _components/
│           │   ├── providers.tsx          # Socket + Room context providers
│           │   ├── connection-status.tsx  # WebSocket status indicator
│           │   ├── room-form.tsx          # Create/join room UI
│           │   ├── room-guard.tsx         # Route protection
│           │   └── room-header.tsx        # Room info bar + leave button
│           ├── _lib/
│           │   ├── env.ts              # NEXT_PUBLIC env vars
│           │   ├── socket.ts           # Singleton socket factory
│           │   ├── socket-context.tsx   # SocketProvider + useSocket hook
│           │   ├── room-context.tsx     # RoomProvider + useRoom hook
│           │   ├── webrtc.ts           # PeerManager class + fetchIceServers
│           │   └── media.ts            # getUserMedia wrapper
│           └── room/[code]/
│               ├── chat/
│               │   ├── page.tsx
│               │   ├── _components/    # chat-room, message-input, message-list,
│               │   │                   # presence-bar, typing-indicator
│               │   └── _hooks/use-chat.ts
│               └── video/
│                   ├── page.tsx
│                   ├── _components/    # video-room, video-controls
│                   └── _hooks/use-webrtc.ts
│
├── packages/
│   ├── ui/                     # Shared React component library
│   ├── tailwind-config/        # Shared Tailwind + PostCSS config
│   ├── typescript-config/      # Shared tsconfig (base, node, nextjs, react-library)
│   └── eslint-config/          # Shared ESLint flat configs
│
├── infrastructure/
│   ├── docker-compose.yml      # Combined stack: signaling + TURN + Caddy
│   ├── Caddyfile               # Reverse proxy + automatic HTTPS config
│   ├── signaling.env.example   # Signaling server env template
│   └── turn/                   # Coturn TURN server
│       ├── Dockerfile
│       ├── docker-compose.yml  # Standalone TURN-only compose (optional)
│       ├── turnserver.conf     # Config template with ${ENV_VAR} placeholders
│       └── .env.example
│
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Prerequisites

- Node.js >= 18
- pnpm 10.x (`corepack enable && corepack prepare pnpm@10.19.0 --activate`)
- Docker (for TURN server)

## Local Development

### 1. Clone and install

```bash
git clone https://github.com/vagxrth/charlar.git
cd charlar
pnpm install
```

### 2. Configure environment variables

**Backend** (`apps/server/.env`):

```bash
cp apps/server/.env.example apps/server/.env
```

```env
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
RECONNECT_TIMEOUT_MS=30000
STUN_URLS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
```

**Frontend** (`apps/web/.env.local`):

```bash
cp apps/web/.env.example apps/web/.env.local
```

```env
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
```

### 3. Start development servers

```bash
pnpm dev
```

This starts both the backend (port 3001) and frontend (port 3000) with hot reload via Turborepo.

### 4. (Optional) Local TURN server

Only needed for testing TURN relay — most local connections work with STUN alone.

```bash
cd infrastructure/turn
cp .env.example .env
# Edit .env: set TURN_SECRET, TURN_EXTERNAL_IP=127.0.0.1, TURN_LISTENING_IP=0.0.0.0
docker compose up
```

Then add to `apps/server/.env`:

```env
TURN_URLS=turn:127.0.0.1:3478
TURN_SECRET=your-secret-here
```

## Production Deployment

The backend (signaling + TURN + reverse proxy) runs on a single small VM. The frontend runs on Vercel.

### 1. Backend (Google Cloud e2-micro)

GCP's Always Free tier covers one `e2-micro` instance in `us-west1`, `us-central1`, or `us-east1` indefinitely.

**Provision the VM:**

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com), set up a billing budget alert ($1/mo with email notifications) as a safety net
2. Compute Engine → **Create Instance**:
   - Machine type: `e2-micro` (free tier)
   - Region: `us-central1` (any zone)
   - Boot disk: Ubuntu 24.04 LTS, 30 GB **Standard persistent disk**
   - Firewall: allow HTTP + HTTPS
3. VPC network → **Firewall** → create rule `charlar-turn`:
   - Ingress, allow from `0.0.0.0/0`
   - TCP: `3478`
   - UDP: `3478,49152-65535`

**Point DNS at the VM:**

Create an A record `api.<your-domain>` pointing to the VM's external IP. Verify with `dig +short api.<your-domain>`.

**Install Docker and deploy:**

SSH into the VM (browser SSH from the console works):

```bash
# Install Docker
sudo apt update && sudo apt install -y ca-certificates curl gnupg
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# log out + back in for group to apply

# Clone repo
git clone https://github.com/vagxrth/charlar.git
cd charlar/infrastructure

# Generate values
PRIVATE_IP=$(hostname -I | awk '{print $1}')
TURN_SECRET=$(openssl rand -hex 32)
PUBLIC_IP=$(curl -s ifconfig.me)
DOMAIN=api.your-domain.com

# Create env files
cp signaling.env.example signaling.env
sed -i "s|^TURN_SECRET=.*|TURN_SECRET=$TURN_SECRET|" signaling.env
sed -i "s|charlar.vagarth.in|your-frontend-domain.com|g" signaling.env
sed -i "s|api.charlar.vagarth.in|$DOMAIN|g" signaling.env

cp turn/.env.example turn/.env
sed -i "s|^TURN_SECRET=.*|TURN_SECRET=$TURN_SECRET|" turn/.env
sed -i "s|^TURN_REALM=.*|TURN_REALM=$DOMAIN|" turn/.env
sed -i "s|^TURN_EXTERNAL_IP=.*|TURN_EXTERNAL_IP=$PUBLIC_IP|" turn/.env
sed -i "s|^TURN_LISTENING_IP=.*|TURN_LISTENING_IP=$PRIVATE_IP|" turn/.env

# Update Caddyfile to use your domain
sed -i "s|api.charlar.vagarth.in|$DOMAIN|" Caddyfile

# Start the stack
sudo docker compose up -d --build
sudo docker compose logs --tail=50
```

The combined `docker-compose.yml` runs three services:
- **signaling** — Express + Socket.IO server (internal port 3001)
- **caddy** — reverse proxy on 80/443 with automatic Let's Encrypt TLS
- **coturn** — TURN server with host networking (for UDP relay performance)

Verify:

```bash
curl https://api.<your-domain>/health
# {"status":"ok","uptime":...,"rooms":0,"sessions":0}

curl https://api.<your-domain>/api/ice-config
# {"iceServers":[{"urls":["stun:..."]},{"urls":["turn:..."],"username":"...","credential":"..."}]}
```

### 2. Frontend (Vercel)

1. Import the repo on [vercel.com](https://vercel.com)
2. Configure build settings:

   | Setting | Value |
   |---|---|
   | Root Directory | `apps/web` |
   | Build Command | `cd ../.. && pnpm turbo run build --filter=web` |
   | Output Directory | `.next` |
   | Install Command | `cd ../.. && pnpm install --frozen-lockfile` |

3. Set environment variable:

   ```
   NEXT_PUBLIC_SERVER_URL=https://api.<your-domain>
   ```

4. Deploy. `TURN_SECRET` is **never set on Vercel** — it stays server-side. The frontend fetches ephemeral credentials from `/api/ice-config` at runtime.

## Socket Events

### Client to Server

| Event | Payload | Response |
|---|---|---|
| `room:create` | `(nickname?, callback)` | `{ ok, code, participantCount, nickname }` |
| `room:join` | `(code, nickname?, callback)` | `{ ok, nickname, participantCount, participants[] }` |
| `room:leave` | `(code, callback)` | `{ ok }` |
| `chat:message` | `{ roomCode, content }` | `{ ok, id, timestamp }` |
| `typing:start` | `(roomCode, callback)` | `{ ok }` |
| `typing:stop` | `(roomCode, callback)` | `{ ok }` |
| `presence:request` | `(roomCode, callback)` | `{ ok, participants[], participantCount }` |
| `signal:offer` | `{ roomCode, targetSessionId, sdp }` | `{ ok }` |
| `signal:answer` | `{ roomCode, targetSessionId, sdp }` | `{ ok }` |
| `signal:ice-candidate` | `{ roomCode, targetSessionId, candidate }` | `{ ok }` |

### Server to Client

| Event | Payload | Target |
|---|---|---|
| `session:created` | `{ sessionId }` | Connecting socket |
| `room:peer-joined` | `{ sessionId, nickname, participantCount }` | Room (excl. sender) |
| `room:peer-left` | `{ sessionId, nickname, participantCount }` | Room |
| `room:peer-disconnected` | `{ sessionId, nickname, participantCount }` | Room |
| `room:peer-reconnected` | `{ sessionId, nickname, participantCount }` | Room |
| `chat:message` | `{ id, sessionId, nickname, content, timestamp }` | Room (excl. sender) |
| `typing:start` / `typing:stop` | `{ sessionId }` | Room |
| `signal:offer` / `signal:answer` | `{ sessionId, sdp }` | Target socket |
| `signal:ice-candidate` | `{ sessionId, candidate }` | Target socket |

## WebRTC Call Flow

1. Both peers join a room via socket events
2. Both fetch local media (camera + mic) and ICE server config in parallel
3. The peer with the lexicographically higher `sessionId` sends the offer (deterministic, no coordination needed)
4. Offer/answer and ICE candidates are relayed through the signaling server
5. Once ICE connectivity is established, media flows directly peer-to-peer
6. If the connection drops, automatic ICE restart is attempted (max 2 times)
7. If the peer's socket disconnects but the session is within the 30s grace period, the WebRTC connection is kept alive waiting for reconnection
