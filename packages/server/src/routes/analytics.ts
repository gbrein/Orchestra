import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { sendSuccess, sendError } from '../lib/errors'

const QuerySchema = z.object({
  workspaceId: z.string().optional(),
  agentId: z.string().optional(),
  days: z.coerce.number().int().min(1).max(90).default(30),
})

export async function analyticsRoutes(app: FastifyInstance) {
  app.get('/api/analytics/cost', async (req, reply) => {
    try {
      const query = QuerySchema.parse(req.query)
      const since = new Date()
      since.setDate(since.getDate() - query.days)

      const where: Record<string, unknown> = {
        createdAt: { gte: since },
      }
      if (query.agentId) where.agentId = query.agentId

      const usages = await prisma.sessionUsage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      })

      // Aggregate by model
      const byModel: Record<string, { inputTokens: number; outputTokens: number; costUsd: number; count: number }> = {}
      let totalCost = 0
      let totalInput = 0
      let totalOutput = 0

      for (const usage of usages) {
        const model = usage.model ?? 'unknown'
        const entry = byModel[model] ?? { inputTokens: 0, outputTokens: 0, costUsd: 0, count: 0 }
        entry.inputTokens += usage.inputTokens
        entry.outputTokens += usage.outputTokens
        entry.costUsd += usage.costUsd
        entry.count++
        byModel[model] = entry

        totalCost += usage.costUsd
        totalInput += usage.inputTokens
        totalOutput += usage.outputTokens
      }

      sendSuccess(reply, {
        period: { days: query.days, since: since.toISOString() },
        total: {
          costUsd: totalCost,
          inputTokens: totalInput,
          outputTokens: totalOutput,
          sessions: usages.length,
        },
        byModel,
      })
    } catch (error) {
      sendError(reply, error)
    }
  })
}
