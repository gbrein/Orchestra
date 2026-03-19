import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { sendSuccess, sendError, NotFoundError } from '../lib/errors'

const CreateSkillSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1),
  source: z.enum(['marketplace', 'git']),
  gitUrl: z.string().optional(),
  path: z.string().min(1),
  version: z.string().optional(),
  author: z.string().optional(),
  category: z.string().optional(),
  icon: z.string().optional(),
  mcpConfig: z.record(z.unknown()).optional(),
})

const AttachSkillSchema = z.object({
  priority: z.number().int().default(0),
  enabled: z.boolean().default(true),
})

export async function skillRoutes(app: FastifyInstance) {
  app.get('/api/skills', async (_req, reply) => {
    try {
      const skills = await prisma.skill.findMany({
        orderBy: { installedAt: 'desc' },
      })
      sendSuccess(reply, skills)
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.get<{ Params: { id: string } }>('/api/skills/:id', async (req, reply) => {
    try {
      const skill = await prisma.skill.findUnique({
        where: { id: req.params.id },
        include: { agents: { include: { agent: true } } },
      })
      if (!skill) throw new NotFoundError('Skill', req.params.id)
      sendSuccess(reply, skill)
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.post('/api/skills', async (req, reply) => {
    try {
      const body = CreateSkillSchema.parse(req.body)
      const skill = await prisma.skill.create({ data: body })
      sendSuccess(reply, skill, 201)
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.delete<{ Params: { id: string } }>('/api/skills/:id', async (req, reply) => {
    try {
      const existing = await prisma.skill.findUnique({ where: { id: req.params.id } })
      if (!existing) throw new NotFoundError('Skill', req.params.id)
      await prisma.skill.delete({ where: { id: req.params.id } })
      sendSuccess(reply, { deleted: true })
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.post<{ Params: { agentId: string; skillId: string } }>(
    '/api/agents/:agentId/skills/:skillId',
    async (req, reply) => {
      try {
        const { agentId, skillId } = req.params
        const body = AttachSkillSchema.parse(req.body ?? {})

        const agent = await prisma.agent.findUnique({ where: { id: agentId } })
        if (!agent) throw new NotFoundError('Agent', agentId)

        const skill = await prisma.skill.findUnique({ where: { id: skillId } })
        if (!skill) throw new NotFoundError('Skill', skillId)

        const agentSkill = await prisma.agentSkill.upsert({
          where: { agentId_skillId: { agentId, skillId } },
          create: { agentId, skillId, ...body },
          update: body,
          include: { skill: true },
        })
        sendSuccess(reply, agentSkill, 201)
      } catch (error) {
        sendError(reply, error)
      }
    },
  )

  app.delete<{ Params: { agentId: string; skillId: string } }>(
    '/api/agents/:agentId/skills/:skillId',
    async (req, reply) => {
      try {
        const { agentId, skillId } = req.params

        const existing = await prisma.agentSkill.findUnique({
          where: { agentId_skillId: { agentId, skillId } },
        })
        if (!existing) {
          throw new NotFoundError(`AgentSkill(agent=${agentId}, skill=${skillId})`, '')
        }

        await prisma.agentSkill.delete({
          where: { agentId_skillId: { agentId, skillId } },
        })
        sendSuccess(reply, { deleted: true })
      } catch (error) {
        sendError(reply, error)
      }
    },
  )
}
