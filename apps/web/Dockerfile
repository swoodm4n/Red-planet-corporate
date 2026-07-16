# Multi-stage build for the Red Planet Corporate web/API service.
# Build context is the REPO ROOT (see docker-compose.yml) so the @rpc/engine
# workspace package is available.

FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install workspace deps (root lockfile covers all workspaces).
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY apps/web/package.json apps/web/
RUN npm ci

# Copy sources and build.
COPY packages/engine packages/engine
COPY apps/web apps/web
RUN npm run build -w @rpc/engine
RUN cd apps/web && npx prisma generate && npx next build

# ---- Runner ----
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Carry the full built workspace so `prisma migrate deploy`, `tsx` (seed +
# scheduler) and `next start` all work from one image.
COPY --from=builder /app /app
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
