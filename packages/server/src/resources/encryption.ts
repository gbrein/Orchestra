import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12   // 96-bit IV is standard for GCM
const TAG_LENGTH = 16  // 128-bit authentication tag
const SALT = 'orchestra-resource-enc-v1'  // static salt — key stays stable across restarts

let _cachedKey: Buffer | null = null

/**
 * Derives (and caches) the AES-256 key from the ORCHESTRA_SECRET env var.
 * Fails fast at startup if the secret is not configured.
 */
function getKey(): Buffer {
  if (_cachedKey !== null) return _cachedKey

  const secret = process.env['ORCHESTRA_SECRET']
  if (!secret || secret.trim().length === 0) {
    throw new Error('ORCHESTRA_SECRET environment variable is required for secret variable encryption')
  }

  // scrypt: N=16384, r=8, p=1 — tuned for server startup latency
  _cachedKey = scryptSync(secret, SALT, 32, { N: 16384, r: 8, p: 1 })
  return _cachedKey
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a base64-encoded string in the format: `iv:tag:ciphertext`
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])

  const tag = cipher.getAuthTag()

  return [
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

/**
 * Decrypts a value produced by `encrypt`.
 * Throws if the ciphertext has been tampered with (GCM auth tag mismatch).
 */
export function decrypt(encoded: string): string {
  const parts = encoded.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format — expected iv:tag:ciphertext')
  }

  const [ivB64, tagB64, ciphertextB64] = parts as [string, string, string]

  const key = getKey()
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const ciphertext = Buffer.from(ciphertextB64, 'base64')

  if (iv.length !== IV_LENGTH) {
    throw new Error('Invalid IV length in encrypted value')
  }
  if (tag.length !== TAG_LENGTH) {
    throw new Error('Invalid auth tag length in encrypted value')
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}
