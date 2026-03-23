# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json turbo.json ./

# Copy all package.json files for install
COPY packages/server/package.json packages/server/
COPY packages/shared/package.json packages/shared/

# Install dependencies
RUN npm ci --workspace=@orchestra/server --workspace=@orchestra/shared --include-workspace-root

# Copy source code
COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/

# Generate Prisma client
RUN npx prisma generate --schema=packages/server/prisma/schema.prisma

# Build shared + server
RUN npm run build --workspace=@orchestra/shared 2>/dev/null || true
RUN npm run build --workspace=@orchestra/server

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-alpine

RUN apk add --no-cache git

WORKDIR /app

# Copy built artifacts and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/node_modules ./packages/server/node_modules
COPY --from=builder /app/packages/server/package.json ./packages/server/
COPY --from=builder /app/packages/server/prisma ./packages/server/prisma
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/package.json ./

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code || true

WORKDIR /app/packages/server

EXPOSE 3001

CMD ["node", "dist/index.js"]
