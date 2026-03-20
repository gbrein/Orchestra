import type { FastifyInstance } from 'fastify'
import { toNodeHandler } from 'better-auth/node'
import { auth } from '../auth/auth'

const UI_ORIGIN = process.env.UI_ORIGIN ?? 'http://localhost:3000'

export async function authRoutes(parent: FastifyInstance): Promise<void> {
  const handler = toNodeHandler(auth)

  // Register in an encapsulated scope so we can override body parsing
  // without affecting other routes. Better Auth reads the raw Node.js
  // IncomingMessage stream directly — Fastify must not consume it first.
  parent.register(async (app) => {
    app.removeAllContentTypeParsers()
    app.addContentTypeParser('*', (_req, _payload, done) => {
      done(null)
    })

    app.all('/api/auth/*', async (request, reply) => {
      const raw = reply.raw
      raw.setHeader('Access-Control-Allow-Origin', UI_ORIGIN)
      raw.setHeader('Access-Control-Allow-Credentials', 'true')
      raw.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
      raw.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

      if (request.method === 'OPTIONS') {
        raw.writeHead(204)
        raw.end()
        reply.hijack()
        return
      }

      await handler(request.raw, raw)
      reply.hijack()
    })
  })
}
