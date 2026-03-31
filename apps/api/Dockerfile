# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# OpenSSL required by Prisma engine on Alpine
RUN apk add --no-cache openssl

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy entire workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma Client (goes into packages/database/node_modules/.prisma/)
RUN pnpm --filter @domusbet/database exec prisma generate

# Build workspace packages in dependency order
RUN pnpm --filter @domusbet/shared-types build
RUN pnpm --filter @domusbet/shared-utils build
RUN pnpm --filter @domusbet/config build
RUN pnpm --filter @domusbet/database build

# Build the API
RUN pnpm --filter api build

# Stage 2: Runner
FROM node:20-alpine AS runner

WORKDIR /app

# OpenSSL required by Prisma engine on Alpine
RUN apk add --no-cache openssl

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy root node_modules (hoisted deps: express, @nestjs/*, etc.)
COPY --from=builder /app/node_modules ./node_modules

# Copy packages — database ENTIRELY (includes node_modules/.prisma generated client)
COPY --from=builder /app/packages/database ./packages/database
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=builder /app/packages/shared-utils/dist ./packages/shared-utils/dist
COPY --from=builder /app/packages/shared-utils/package.json ./packages/shared-utils/
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/packages/config/package.json ./packages/config/

# Copy api app-level node_modules (pnpm workspace symlinks to @domusbet/*)
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/

# pnpm needs these to resolve workspace
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./

# Set ownership
RUN chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3001

CMD ["node", "apps/api/dist/main"]
