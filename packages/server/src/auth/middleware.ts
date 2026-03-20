import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify'
import { auth } from './auth'
import { fromNodeHeaders } from 'better-auth/node'

// Paths that don't require authentication
const PUBLIC_PATHS = new Set([
  '/api/health',
])

const PUBLIC_PREFIXES = [
  '/api/auth',
]

function isPublicPath(path: string): boolean {
  if (PUBLIC_PATHS.has(path)) return true
  return PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))
}

// Extend Fastify request with user info
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string
      email: string
      name: string
      image?: string | null
    }
  }
}

export async function registerAuthMiddleware(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (isPublicPath(request.url)) return

    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      })

      if (!session) {
        reply.code(401).send({
          success: false,
          error: 'Authentication required',
        })
        return
      }

      request.user = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      }
    } catch {
      reply.code(401).send({
        success: false,
        error: 'Invalid session',
      })
    }
  })
}
