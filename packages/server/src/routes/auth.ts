import type { FastifyInstance } from 'fastify'
import { toNodeHandler } from 'better-auth/node'
import { auth } from '../auth/auth'

const UI_ORIGIN = process.env.UI_ORIGIN ?? 'http://localhost:3000'

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const handler = toNodeHandler(auth)

  // Catch-all for /api/auth/* — forward to better-auth.
  // reply.hijack() bypasses Fastify's CORS plugin, so we set headers manually.
  app.all('/api/auth/*', async (request, reply) => {
    const raw = reply.raw
    raw.setHeader('Access-Control-Allow-Origin', UI_ORIGIN)
    raw.setHeader('Access-Control-Allow-Credentials', 'true')
    raw.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    raw.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    // Handle preflight
    if (request.method === 'OPTIONS') {
      raw.writeHead(204)
      raw.end()
      reply.hijack()
      return
    }

    await handler(request.raw, raw)
    reply.hijack()
  })
}
