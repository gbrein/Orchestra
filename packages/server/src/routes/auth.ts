import type { FastifyInstance } from 'fastify'
import { toNodeHandler } from 'better-auth/node'
import { auth } from '../auth/auth'

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const handler = toNodeHandler(auth)

  // Catch-all for /api/auth/* — forward to better-auth
  app.all('/api/auth/*', async (request, reply) => {
    await handler(request.raw, reply.raw)
    // Prevent Fastify from sending another response
    reply.hijack()
  })
}
