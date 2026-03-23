import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { sendSuccess, sendError, NotFoundError } from '../lib/errors'

const CreateAgentSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  persona: z.string().min(1),
  description: z.string().optional(),
  avatar: z.string().optional(),
  purpose: z.string().optional(),
  scope: z.array(z.string()).default([]),
  allowedTools: z.array(z.string()).default([]),
  memoryEnabled: z.boolean().default(false),
  model: z.string().optional(),
  permissionMode: z.enum(['plan', 'default', 'edit']).default('default'),
})

const UpdateAgentSchema = CreateAgentSchema.partial().extend({
  isFavorite: z.boolean().optional(),
})

export async function agentRoutes(app: FastifyInstance) {
  app.get('/api/agents', async (req, reply) => {
    try {
      const userId = req.user?.id
      const agents = await prisma.agent.findMany({
        where: userId ? { OR: [{ userId }, { userId: null }] } : undefined,
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
      const agent = await prisma.agent.create({
        data: { ...body, userId: req.user?.id },
      })
      sendSuccess(reply, agent, 201)
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.patch<{ Params: { id: string } }>('/api/agents/:id', async (req, reply) => {
    try {
      const raw = req.body as Record<string, unknown>
      const body = UpdateAgentSchema.parse(raw)

      // Validate and pass through additional known fields
      const ExtraFieldsSchema = z.object({
        status: z.enum(['idle', 'running', 'error', 'waiting_approval']).optional(),
        canvasX: z.number().optional(),
        canvasY: z.number().optional(),
        loopEnabled: z.boolean().optional(),
        loopCriteria: z.union([
          z.object({ type: z.literal('max_iterations'), value: z.string().max(200) }),
          z.object({ type: z.literal('regex'), value: z.string().max(500) }),
          z.object({ type: z.literal('test_pass'), value: z.string().regex(/^[\w .\/\-]+$/).max(200) }),
          z.object({ type: z.literal('manual'), value: z.string().max(200) }),
        ]).nullable().optional(),
        maxIterations: z.number().int().min(1).max(100).optional(),
        teamEnabled: z.boolean().optional(),
      }).partial()
      const extra = ExtraFieldsSchema.parse(raw)
      const data: Record<string, unknown> = { ...body, ...extra }

      const existing = await prisma.agent.findUnique({ where: { id: req.params.id } })
      if (!existing) throw new NotFoundError('Agent', req.params.id)
      const agent = await prisma.agent.update({
        where: { id: req.params.id },
        data,
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
