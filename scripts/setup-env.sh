#!/usr/bin/env bash
# Generate .env files from .env.example with a random BETTER_AUTH_SECRET.
# Skips if .env already exists (won't overwrite user config).

set -euo pipefail

SERVER_DIR="packages/server"
ENV_FILE="$SERVER_DIR/.env"
EXAMPLE_FILE="$SERVER_DIR/.env.example"

if [ -f "$ENV_FILE" ]; then
  # .env exists — ensure BETTER_AUTH_SECRET is present
  if ! grep -q "^BETTER_AUTH_SECRET=" "$ENV_FILE"; then
    SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    echo "" >> "$ENV_FILE"
    echo "# Better Auth" >> "$ENV_FILE"
    echo "BETTER_AUTH_SECRET=$SECRET" >> "$ENV_FILE"
    echo "BETTER_AUTH_URL=http://localhost:3001" >> "$ENV_FILE"
    echo "[setup-env] Added BETTER_AUTH_SECRET to existing $ENV_FILE"
  else
    echo "[setup-env] $ENV_FILE already exists with BETTER_AUTH_SECRET — skipping"
  fi
else
  # Generate new .env from example
  SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  sed "s/change-me-to-a-random-secret/$SECRET/" "$EXAMPLE_FILE" > "$ENV_FILE"
  echo "[setup-env] Created $ENV_FILE with generated secret"
fi
