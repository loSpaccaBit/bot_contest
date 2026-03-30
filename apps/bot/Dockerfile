# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests and lock file
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy all packages
COPY packages/ ./packages/
COPY apps/bot/ ./apps/bot/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build workspace packages in dependency order
RUN pnpm --filter @domusbet/shared-types build
RUN pnpm --filter @domusbet/shared-utils build
RUN pnpm --filter @domusbet/config build

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
COPY --from=builder /app/pnpm-lock.yaml ./

# Copy package manifests
COPY --from=builder /app/packages/config/package.json ./packages/config/
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=builder /app/packages/shared-utils/package.json ./packages/shared-utils/
COPY --from=builder /app/apps/bot/package.json ./apps/bot/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy compiled output
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-utils/dist ./packages/shared-utils/dist
COPY --from=builder /app/apps/bot/dist ./apps/bot/dist

USER botuser

WORKDIR /app/apps/bot

CMD ["node", "dist/main.js"]
