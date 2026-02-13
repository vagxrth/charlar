FROM node:22-slim AS builder
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/typescript-config/ packages/typescript-config/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile --filter @repo/server...
COPY apps/server/ apps/server/
RUN pnpm --filter @repo/server run build

FROM node:22-slim AS runner
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/typescript-config/ packages/typescript-config/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile --filter @repo/server... --prod
COPY --from=builder /app/apps/server/dist apps/server/dist
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "apps/server/dist/index.js"]
