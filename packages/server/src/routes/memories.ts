import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { sendSuccess, sendError, NotFoundError } from '../lib/errors'

const CreateMemorySchema = z.object({
  key: z.string().min(1).max(255),
  value: z.string(),
})

const UpdateMemorySchema = z.object({
  value: z.string(),
})

export async function memoryRoutes(app: FastifyInstance) {
  // List memories for an agent
  app.get<{ Params: { agentId: string } }>('/api/agents/:agentId/memories', async (req, reply) => {
    try {
      const memories = await prisma.memory.findMany({
        where: { agentId: req.params.agentId },
        orderBy: { key: 'asc' },
      })
      sendSuccess(reply, memories)
    } catch (error) {
      sendError(reply, error)
    }
  })

  // Create a memory
  app.post<{ Params: { agentId: string } }>('/api/agents/:agentId/memories', async (req, reply) => {
    try {
      const body = CreateMemorySchema.parse(req.body)
      const agent = await prisma.agent.findUnique({ where: { id: req.params.agentId } })
      if (!agent) throw new NotFoundError('Agent', req.params.agentId)

      const memory = await prisma.memory.upsert({
        where: {
          agentId_key: {
            agentId: req.params.agentId,
            key: body.key,
          },
        },
        create: {
          agentId: req.params.agentId,
          key: body.key,
          value: body.value,
        },
        update: {
          value: body.value,
        },
      })
      sendSuccess(reply, memory, 201)
    } catch (error) {
      sendError(reply, error)
    }
  })

  // Update a memory
  app.patch<{ Params: { agentId: string; memoryId: string } }>(
    '/api/agents/:agentId/memories/:memoryId',
    async (req, reply) => {
      try {
        const body = UpdateMemorySchema.parse(req.body)
        const existing = await prisma.memory.findFirst({
          where: { id: req.params.memoryId, agentId: req.params.agentId },
        })
        if (!existing) throw new NotFoundError('Memory', req.params.memoryId)

        const memory = await prisma.memory.update({
          where: { id: req.params.memoryId },
          data: { value: body.value },
        })
        sendSuccess(reply, memory)
      } catch (error) {
        sendError(reply, error)
      }
    },
  )

  // Delete a memory
  app.delete<{ Params: { agentId: string; memoryId: string } }>(
    '/api/agents/:agentId/memories/:memoryId',
    async (req, reply) => {
      try {
        const existing = await prisma.memory.findFirst({
          where: { id: req.params.memoryId, agentId: req.params.agentId },
        })
        if (!existing) throw new NotFoundError('Memory', req.params.memoryId)

        await prisma.memory.delete({ where: { id: req.params.memoryId } })
        sendSuccess(reply, { deleted: true })
      } catch (error) {
        sendError(reply, error)
      }
    },
  )
}
