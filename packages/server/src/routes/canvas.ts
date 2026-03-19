import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { sendSuccess, sendError, NotFoundError } from '../lib/errors'

const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
})

const SaveCanvasSchema = z.object({
  name: z.string().min(1).default('default'),
  viewport: z.record(z.unknown()),
  nodes: z.array(z.record(z.unknown())),
  edges: z.array(z.record(z.unknown())),
})

export async function canvasRoutes(app: FastifyInstance) {
  app.get('/api/workspaces', async (_req, reply) => {
    try {
      const workspaces = await prisma.workspace.findMany({
        include: {
          canvasLayouts: { select: { id: true, name: true, updatedAt: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      sendSuccess(reply, workspaces)
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.post('/api/workspaces', async (req, reply) => {
    try {
      const body = CreateWorkspaceSchema.parse(req.body)
      const workspace = await prisma.workspace.create({ data: body })
      sendSuccess(reply, workspace, 201)
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.get<{ Params: { id: string } }>('/api/workspaces/:id/canvas', async (req, reply) => {
    try {
      const workspace = await prisma.workspace.findUnique({
        where: { id: req.params.id },
      })
      if (!workspace) throw new NotFoundError('Workspace', req.params.id)

      const layout = await prisma.canvasLayout.findFirst({
        where: { workspaceId: req.params.id },
        orderBy: { updatedAt: 'desc' },
      })
      sendSuccess(reply, layout ?? null)
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.put<{ Params: { id: string } }>('/api/workspaces/:id/canvas', async (req, reply) => {
    try {
      const { id: workspaceId } = req.params
      const body = SaveCanvasSchema.parse(req.body)

      const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } })
      if (!workspace) throw new NotFoundError('Workspace', workspaceId)

      const existing = await prisma.canvasLayout.findFirst({
        where: { workspaceId, name: body.name },
      })

      const layout = existing
        ? await prisma.canvasLayout.update({
            where: { id: existing.id },
            data: {
              viewport: body.viewport as any,
              nodes: body.nodes as any,
              edges: body.edges as any,
            },
          })
        : await prisma.canvasLayout.create({
            data: {
              workspaceId,
              viewport: body.viewport as any,
              nodes: body.nodes as any,
              edges: body.edges as any,
            },
          })

      sendSuccess(reply, layout)
    } catch (error) {
      sendError(reply, error)
    }
  })
}
