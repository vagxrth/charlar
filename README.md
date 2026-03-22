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
| Railway | Signaling server (Docker-based) |
| Vercel | Frontend hosting |
| DigitalOcean Droplet | TURN server VPS |

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
         │  Signaling Server │  ← Railway
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
         │   TURN Server    │  ← DigitalOcean VPS
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
│   └── turn/                   # Coturn TURN server
│       ├── Dockerfile
│       ├── docker-compose.yml
│       ├── turnserver.conf     # Config template with ${ENV_VAR} placeholders
│       └── .env.example
│
├── turbo.json
├── pnpm-workspace.yaml
├── railway.toml
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

### 1. Signaling Server (Railway)

The repo includes a `railway.toml` at the root that configures the Docker-based deployment automatically.

1. Create a new project on [railway.app](https://railway.app) and deploy from GitHub
2. Railway detects `railway.toml` and uses `apps/server/Dockerfile` — **do not change the root directory**
3. Set environment variables on the service:

   ```
   CORS_ORIGIN=https://your-frontend-domain.com
   STUN_URLS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
   TURN_URLS=turn:your-vps-ip:3478
   TURN_SECRET=your-shared-secret
   ```

   **Do not set `PORT`** — Railway injects it automatically.

4. Verify: `curl https://your-railway-url.up.railway.app/health`

### 2. TURN Server (VPS)

Use any VPS provider (DigitalOcean, Hetzner, AWS Lightsail). Minimum: 1 CPU, 1 GB RAM, Ubuntu 24.04.

**Open firewall ports:**

| Port | Protocol | Purpose |
|---|---|---|
| 22 | TCP | SSH |
| 3478 | TCP + UDP | TURN |
| 49152-65535 | UDP | Relay range |

**Setup:**

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Clone and configure
git clone https://github.com/vagxrth/charlar.git
cd charlar/infrastructure/turn
cp .env.example .env
```

Edit `.env`:

```env
TURN_SECRET=<same secret as Railway>
TURN_REALM=your-vps-ip-or-domain
TURN_EXTERNAL_IP=<your VPS public IP>
TURN_LISTENING_IP=0.0.0.0
TURN_MIN_PORT=49152
TURN_MAX_PORT=65535
```

Generate a strong secret: `openssl rand -hex 32`

```bash
docker compose up -d
docker compose logs  # verify coturn starts without errors
```

### 3. Frontend (Vercel)

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
   NEXT_PUBLIC_SERVER_URL=https://your-railway-url.up.railway.app
   ```

4. Deploy and note the Vercel URL
5. **Update Railway** `CORS_ORIGIN` to the Vercel URL (replace the `*` placeholder)

### Verify the full stack

```bash
# Health check
curl https://your-railway-url.up.railway.app/health

# ICE config (should show both STUN and TURN entries)
curl https://your-railway-url.up.railway.app/api/ice-config
```

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
