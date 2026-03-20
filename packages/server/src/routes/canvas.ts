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
  app.get('/api/workspaces', async (req, reply) => {
    try {
      const userId = req.user?.id
      const workspaces = await prisma.workspace.findMany({
        where: userId ? { OR: [{ userId }, { userId: null }] } : undefined,
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
      const workspace = await prisma.workspace.create({
        data: { ...body, userId: req.user?.id },
      })
      sendSuccess(reply, workspace, 201)
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.patch<{ Params: { id: string } }>('/api/workspaces/:id', async (req, reply) => {
    try {
      const { id } = req.params
      const body = CreateWorkspaceSchema.parse(req.body)
      const userId = req.user?.id

      const workspace = await prisma.workspace.findUnique({ where: { id } })
      if (!workspace) throw new NotFoundError('Workspace', id)
      if (userId && workspace.userId && workspace.userId !== userId) {
        return sendError(reply, new NotFoundError('Workspace', id))
      }

      const updated = await prisma.workspace.update({
        where: { id },
        data: { name: body.name },
      })
      sendSuccess(reply, updated)
    } catch (error) {
      sendError(reply, error)
    }
  })

  app.delete<{ Params: { id: string } }>('/api/workspaces/:id', async (req, reply) => {
    try {
      const { id } = req.params
      const userId = req.user?.id

      const workspace = await prisma.workspace.findUnique({ where: { id } })
      if (!workspace) throw new NotFoundError('Workspace', id)
      if (userId && workspace.userId && workspace.userId !== userId) {
        return sendError(reply, new NotFoundError('Workspace', id))
      }

      // Prevent deleting the last workspace
      const count = await prisma.workspace.count({
        where: userId ? { OR: [{ userId }, { userId: null }] } : undefined,
      })
      if (count <= 1) {
        return reply.status(400).send({
          success: false,
          error: 'Cannot delete the last workspace',
        })
      }

      await prisma.workspace.delete({ where: { id } })
      sendSuccess(reply, { deleted: true })
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

  // Update workspace context document
  app.patch<{ Params: { id: string } }>('/api/workspaces/:id/context', async (req, reply) => {
    try {
      const { id: workspaceId } = req.params
      const body = z.object({ contextDocument: z.string().nullable() }).parse(req.body)

      const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } })
      if (!workspace) throw new NotFoundError('Workspace', workspaceId)

      const updated = await prisma.workspace.update({
        where: { id: workspaceId },
        data: { contextDocument: body.contextDocument },
      })
      sendSuccess(reply, updated)
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
