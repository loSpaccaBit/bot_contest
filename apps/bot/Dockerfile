# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests and lock file
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml* ./
COPY tsconfig.base.json ./

# Copy package manifests for all workspace packages used by the bot
COPY packages/config/package.json ./packages/config/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/

# Copy bot package manifest
COPY apps/bot/package.json ./apps/bot/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source for workspace packages
COPY packages/config/src ./packages/config/src
COPY packages/config/tsconfig.json ./packages/config/
COPY packages/shared-types/src ./packages/shared-types/src
COPY packages/shared-types/tsconfig.json ./packages/shared-types/
COPY packages/shared-utils/src ./packages/shared-utils/src

# Copy bot source
COPY apps/bot/src ./apps/bot/src
COPY apps/bot/tsconfig.json ./apps/bot/

# Build workspace dependencies first
RUN pnpm --filter @domusbet/config build || true
RUN pnpm --filter @domusbet/shared-types build || true
RUN pnpm --filter @domusbet/shared-utils build || true

# Build the bot
RUN pnpm --filter bot build

# ─── Stage 2: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@latest --activate

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 botuser

WORKDIR /app

# Copy workspace manifests
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/package.json ./

# Copy package manifests
COPY --from=builder /app/packages/config/package.json ./packages/config/
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=builder /app/packages/shared-utils/package.json ./packages/shared-utils/
COPY --from=builder /app/apps/bot/package.json ./apps/bot/

# Install production dependencies only
COPY --from=builder /app/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod

# Copy compiled output
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-utils/dist ./packages/shared-utils/dist
COPY --from=builder /app/apps/bot/dist ./apps/bot/dist

# Use non-root user
USER botuser

WORKDIR /app/apps/bot

# Polling mode — no port exposed
CMD ["node", "dist/main.js"]
