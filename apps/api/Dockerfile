# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# OpenSSL required by Prisma engine on Alpine
RUN apk add --no-cache openssl

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy entire workspace (required for pnpm workspace resolution)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma Client
RUN pnpm --filter @domusbet/database exec prisma generate

# Build workspace packages in dependency order
RUN pnpm --filter @domusbet/shared-types build
RUN pnpm --filter @domusbet/shared-utils build
RUN pnpm --filter @domusbet/config build
RUN pnpm --filter @domusbet/database build

# Build the API
RUN pnpm --filter api build

# Create self-contained deployment directory (resolves all workspace deps)
RUN pnpm --filter api --prod deploy --legacy /deploy

# Copy Prisma generated client — find the @prisma+client dir in both stores
# and copy .prisma from builder's virtual store to deploy's virtual store
RUN set -e && \
    SRC=$(find /app/node_modules/.pnpm -maxdepth 1 -name "@prisma+client*" -type d | head -1) && \
    DST=$(find /deploy/node_modules/.pnpm -maxdepth 1 -name "@prisma+client*" -type d | head -1) && \
    echo "SRC=$SRC" && echo "DST=$DST" && \
    cp -r "$SRC/node_modules/.prisma" "$DST/node_modules/.prisma"

# Stage 2: Runner
FROM node:20-alpine AS runner

WORKDIR /app

# OpenSSL required by Prisma engine on Alpine
RUN apk add --no-cache openssl

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy the self-contained deployment (node_modules + dist already resolved)
COPY --from=builder /deploy .

# Set ownership
RUN chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3001

CMD ["node", "dist/main"]
