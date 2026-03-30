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

# Copy Prisma generated client into deploy pnpm store (not included by pnpm deploy)
RUN for d in /deploy/node_modules/.pnpm/@prisma+client*/; do \
        v=$(basename "$d"); \
        src="/app/node_modules/.pnpm/$v/node_modules/.prisma"; \
        dst="$d/node_modules/.prisma"; \
        [ -d "$src" ] && cp -r "$src" "$dst" && echo "Copied .prisma to $dst"; \
    done

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

# dist/main because pnpm deploy flattens the app to the root of /deploy
CMD ["node", "dist/main"]
