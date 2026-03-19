import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { sendSuccess, sendError, NotFoundError } from '../lib/errors'

const CreateAgentSchema = z.object({
  name: z.string().min(1).max(100),
  persona: z.string().min(1),
  description: z.string().optional(),
  avatar: z.string().optional(),
  purpose: z.string().optional(),
  scope: z.array(z.string()).default([]),
  allowedTools: z.array(z.string()).default([]),
  memoryEnabled: z.boolean().default(false),
  model: z.enum(['opus', 'sonnet', 'haiku']).optional(),
})

const UpdateAgentSchema = CreateAgentSchema.partial()

export async function agentRoutes(app: FastifyInstance) {
  app.get('/api/agents', async (_req, reply) => {
    try {
      const agents = await prisma.agent.findMany({
        include: {
          skills: { include: { skill: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      sendSuccess(reply, agents)
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.get<{ Params: { id: string } }>('/api/agents/:id', async (req, reply) => {
    try {
      const agent = await prisma.agent.findUnique({
        where: { id: req.params.id },
        include: {
          skills: { include: { skill: true } },
          policies: true,
          memories: true,
        },
      })
      if (!agent) throw new NotFoundError('Agent', req.params.id)
      sendSuccess(reply, agent)
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.post('/api/agents', async (req, reply) => {
    try {
      const body = CreateAgentSchema.parse(req.body)
      const agent = await prisma.agent.create({ data: body })
      sendSuccess(reply, agent, 201)
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.patch<{ Params: { id: string } }>('/api/agents/:id', async (req, reply) => {
    try {
      const body = UpdateAgentSchema.parse(req.body)
      const existing = await prisma.agent.findUnique({ where: { id: req.params.id } })
      if (!existing) throw new NotFoundError('Agent', req.params.id)
      const agent = await prisma.agent.update({
        where: { id: req.params.id },
        data: body,
      })
      sendSuccess(reply, agent)
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.delete<{ Params: { id: string } }>('/api/agents/:id', async (req, reply) => {
    try {
      const existing = await prisma.agent.findUnique({ where: { id: req.params.id } })
      if (!existing) throw new NotFoundError('Agent', req.params.id)
      await prisma.agent.delete({ where: { id: req.params.id } })
      sendSuccess(reply, { deleted: true })
    } catch (error) {
      sendError(reply, error)
    }
  })
}
