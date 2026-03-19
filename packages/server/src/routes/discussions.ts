import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { sendSuccess, sendError, NotFoundError } from '../lib/errors'

const CreateDiscussionSchema = z.object({
  name: z.string().min(1).max(100),
  topic: z.string().min(1),
  format: z.enum(['brainstorm', 'review', 'deliberation']),
  moderatorId: z.string().min(1),
  maxRounds: z.number().int().min(1).default(5),
})

const UpdateDiscussionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  topic: z.string().min(1).optional(),
  format: z.enum(['brainstorm', 'review', 'deliberation']).optional(),
  status: z.enum(['draft', 'active', 'concluded']).optional(),
  conclusion: z.string().optional(),
  maxRounds: z.number().int().min(1).optional(),
})

const AddParticipantSchema = z.object({
  agentId: z.string().min(1),
  role: z.enum(['participant', 'observer', 'devil_advocate']).default('participant'),
})

export async function discussionRoutes(app: FastifyInstance) {
  app.get('/api/discussions', async (_req, reply) => {
    try {
      const discussions = await prisma.discussionTable.findMany({
        include: {
          moderator: { select: { id: true, name: true, avatar: true } },
          participants: { include: { agent: { select: { id: true, name: true, avatar: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      })
      sendSuccess(reply, discussions)
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.get<{ Params: { id: string } }>('/api/discussions/:id', async (req, reply) => {
    try {
      const discussion = await prisma.discussionTable.findUnique({
        where: { id: req.params.id },
        include: {
          moderator: { select: { id: true, name: true, avatar: true } },
          participants: {
            include: { agent: { select: { id: true, name: true, avatar: true } } },
          },
          sessions: {
            orderBy: { startedAt: 'desc' },
            take: 10,
          },
        },
      })
      if (!discussion) throw new NotFoundError('Discussion', req.params.id)
      sendSuccess(reply, discussion)
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.post('/api/discussions', async (req, reply) => {
    try {
      const body = CreateDiscussionSchema.parse(req.body)
      const moderator = await prisma.agent.findUnique({ where: { id: body.moderatorId } })
      if (!moderator) throw new NotFoundError('Agent', body.moderatorId)
      const discussion = await prisma.discussionTable.create({ data: body })
      sendSuccess(reply, discussion, 201)
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.patch<{ Params: { id: string } }>('/api/discussions/:id', async (req, reply) => {
    try {
      const body = UpdateDiscussionSchema.parse(req.body)
      const existing = await prisma.discussionTable.findUnique({ where: { id: req.params.id } })
      if (!existing) throw new NotFoundError('Discussion', req.params.id)
      const discussion = await prisma.discussionTable.update({
        where: { id: req.params.id },
        data: body,
      })
      sendSuccess(reply, discussion)
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.delete<{ Params: { id: string } }>('/api/discussions/:id', async (req, reply) => {
    try {
      const existing = await prisma.discussionTable.findUnique({ where: { id: req.params.id } })
      if (!existing) throw new NotFoundError('Discussion', req.params.id)
      await prisma.discussionTable.delete({ where: { id: req.params.id } })
      sendSuccess(reply, { deleted: true })
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.post<{ Params: { id: string } }>('/api/discussions/:id/participants', async (req, reply) => {
    try {
      const { id: tableId } = req.params
      const body = AddParticipantSchema.parse(req.body)

      const discussion = await prisma.discussionTable.findUnique({ where: { id: tableId } })
      if (!discussion) throw new NotFoundError('Discussion', tableId)

      const agent = await prisma.agent.findUnique({ where: { id: body.agentId } })
      if (!agent) throw new NotFoundError('Agent', body.agentId)

      const participant = await prisma.tableParticipant.upsert({
        where: { tableId_agentId: { tableId, agentId: body.agentId } },
        create: { tableId, agentId: body.agentId, role: body.role },
        update: { role: body.role },
        include: { agent: { select: { id: true, name: true, avatar: true } } },
      })
      sendSuccess(reply, participant, 201)
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.delete<{ Params: { id: string; agentId: string } }>(
    '/api/discussions/:id/participants/:agentId',
    async (req, reply) => {
      try {
        const { id: tableId, agentId } = req.params

        const existing = await prisma.tableParticipant.findUnique({
          where: { tableId_agentId: { tableId, agentId } },
        })
        if (!existing) {
          throw new NotFoundError(`Participant(table=${tableId}, agent=${agentId})`, '')
        }

        await prisma.tableParticipant.delete({
          where: { tableId_agentId: { tableId, agentId } },
        })
        sendSuccess(reply, { deleted: true })
      } catch (error) {
        sendError(reply, error)
      }
    },
  )
}
