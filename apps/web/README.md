# Charlar Web

Next.js frontend for Charlar. It provides the room lobby, realtime chat UI, and browser WebRTC video room experience.

## Local Development

From the repository root:

```bash
pnpm install
pnpm dev
```

This starts the web app on [http://localhost:3000](http://localhost:3000) and the signaling server on `http://localhost:3001` through Turborepo.

To run only the frontend:

```bash
pnpm --filter web dev
```

The frontend expects the backend URL in `NEXT_PUBLIC_SERVER_URL`. For local development:

```bash
cp apps/web/.env.example apps/web/.env.local
```

```env
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
```

## Useful Commands

Run these from the repository root:

```bash
pnpm --filter web check-types
pnpm --filter web lint
pnpm --filter web build
```

## App Structure

- `app/page.tsx` - lobby with nickname, mode selection, create, and join controls.
- `app/_components` - shared room shell, connection status, and providers.
- `app/_lib` - Socket.IO client, room context, media helpers, and WebRTC peer manager.
- `app/room/[code]/chat` - realtime chat route.
- `app/room/[code]/video` - WebRTC video call route.

## Deployment

Deploy this app on Vercel with:

- Root Directory: `apps/web`
- Install Command: `cd ../.. && pnpm install --frozen-lockfile`
- Build Command: `cd ../.. && pnpm turbo run build --filter=web`
- Output Directory: `.next`

Set `NEXT_PUBLIC_SERVER_URL` to the deployed signaling server URL, then set the backend `CORS_ORIGIN` to the Vercel URL.
