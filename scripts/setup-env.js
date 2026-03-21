#!/usr/bin/env node
// Generate root .env from .env.example with a random BETTER_AUTH_SECRET.
// Skips if .env already exists (won't overwrite user config).
// Cross-platform replacement for setup-env.sh.

const fs = require('fs')
const crypto = require('crypto')
const path = require('path')

const ENV_FILE = path.join(__dirname, '..', '.env')
const EXAMPLE_FILE = path.join(__dirname, '..', '.env.example')

function generateSecret() {
  return crypto.randomBytes(32).toString('hex')
}

if (fs.existsSync(ENV_FILE)) {
  const content = fs.readFileSync(ENV_FILE, 'utf8')
  if (!content.includes('BETTER_AUTH_SECRET=')) {
    const secret = generateSecret()
    const additions = `\n# Better Auth\nBETTER_AUTH_SECRET=${secret}\nBETTER_AUTH_URL=http://localhost:3001\n`
    fs.appendFileSync(ENV_FILE, additions)
    console.log('[setup-env] Added BETTER_AUTH_SECRET to existing .env')
  } else {
    console.log('[setup-env] .env already exists with BETTER_AUTH_SECRET — skipping')
  }
} else {
  if (!fs.existsSync(EXAMPLE_FILE)) {
    console.error('[setup-env] .env.example not found')
    process.exit(1)
  }
  const secret = generateSecret()
  const content = fs.readFileSync(EXAMPLE_FILE, 'utf8')
  const result = content.replace('change-me-to-a-random-secret', secret)
  fs.writeFileSync(ENV_FILE, result)
  console.log('[setup-env] Created .env with generated secret')
}
