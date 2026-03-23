# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json turbo.json ./

# Copy all package.json files for install
COPY packages/ui/package.json packages/ui/
COPY packages/shared/package.json packages/shared/

# Install dependencies
RUN npm ci --workspace=@orchestra/ui --workspace=@orchestra/shared --include-workspace-root

# Copy source code
COPY packages/shared/ packages/shared/
COPY packages/ui/ packages/ui/

# Build shared first
RUN npm run build --workspace=@orchestra/shared 2>/dev/null || true

# Build Next.js (standalone output for Docker)
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=1
RUN npm run build --workspace=@orchestra/ui

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy Next.js standalone build
COPY --from=builder /app/packages/ui/.next/standalone ./
COPY --from=builder /app/packages/ui/.next/static ./packages/ui/.next/static
COPY --from=builder /app/packages/ui/public ./packages/ui/public

EXPOSE 3000

CMD ["node", "packages/ui/server.js"]
