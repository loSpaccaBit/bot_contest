# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

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

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy workspace config files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy packages (needed for runtime)
COPY packages/ ./packages/
COPY apps/api/package.json ./apps/api/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Set ownership
RUN chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3001

CMD ["node", "apps/api/dist/main"]
