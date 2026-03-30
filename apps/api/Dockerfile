# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# OpenSSL required by Prisma engine on Alpine
RUN apk add --no-cache openssl

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace config files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy packages
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma Client and build workspace packages
RUN pnpm --filter @domusbet/database exec prisma generate
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

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy node_modules from builder (includes generated Prisma client)
COPY --from=builder /app/node_modules ./node_modules

# Copy built packages dist + package.json
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/package.json ./packages/database/
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=builder /app/packages/shared-utils/dist ./packages/shared-utils/dist
COPY --from=builder /app/packages/shared-utils/package.json ./packages/shared-utils/
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/packages/config/package.json ./packages/config/
COPY --from=builder /app/apps/api/package.json ./apps/api/

# Copy built application
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Create workspace symlinks so Node can resolve @domusbet/* from apps/api/
RUN mkdir -p /app/apps/api/node_modules/@domusbet && \
    ln -sf /app/packages/database     /app/apps/api/node_modules/@domusbet/database && \
    ln -sf /app/packages/shared-types /app/apps/api/node_modules/@domusbet/shared-types && \
    ln -sf /app/packages/shared-utils /app/apps/api/node_modules/@domusbet/shared-utils && \
    ln -sf /app/packages/config       /app/apps/api/node_modules/@domusbet/config

# Set ownership
RUN chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3001

CMD ["node", "apps/api/dist/main"]
