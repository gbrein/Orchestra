import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { sendSuccess, sendError } from '../lib/errors'

const QuerySchema = z.object({
  workspaceId: z.string().optional(),
  agentId: z.string().optional(),
  type: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export async function activityRoutes(app: FastifyInstance) {
  app.get('/api/activity', async (req, reply) => {
    try {
      const query = QuerySchema.parse(req.query)
      const { page, limit, ...filters } = query

      const where: Record<string, unknown> = {}
      if (filters.workspaceId) where.workspaceId = filters.workspaceId
      if (filters.agentId) where.agentId = filters.agentId
      if (filters.type) where.type = filters.type
      if (req.user?.id) where.userId = req.user.id

      const [events, total] = await Promise.all([
        prisma.activityEvent.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.activityEvent.count({ where }),
      ])

      reply.code(200).send({
        success: true,
        data: events,
        meta: { total, page, limit },
      })
    } catch (error) {
      sendError(reply, error)
    }
  })
}
