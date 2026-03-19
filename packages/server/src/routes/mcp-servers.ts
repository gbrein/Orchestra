import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { sendSuccess, sendError, NotFoundError } from '../lib/errors'
import type { Prisma } from '@prisma/client'

// ------------------------------------------------------------------
// Validation schemas
// ------------------------------------------------------------------

const CreateMcpServerSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  type: z.string().default('stdio'),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).optional(),
})

const UpdateMcpServerSchema = CreateMcpServerSchema.partial()

// ------------------------------------------------------------------
// Route plugin
// ------------------------------------------------------------------

export async function mcpServerRoutes(app: FastifyInstance) {
  // -------------------------------------------------------------------------
  // MCP Server CRUD
  // -------------------------------------------------------------------------

  /**
   * GET /api/mcp-servers
   * List all registered MCP servers.
   */
  app.get('/api/mcp-servers', async (_req, reply) => {
    try {
      const servers = await prisma.mcpServer.findMany({
        orderBy: { createdAt: 'desc' },
      })
      sendSuccess(reply, servers)
    } catch (error) {
      sendError(reply, error)
    }
  })

  /**
   * GET /api/mcp-servers/:id
   * Get a single MCP server with its agent assignments.
   */
  app.get<{ Params: { id: string } }>('/api/mcp-servers/:id', async (req, reply) => {
    try {
      const server = await prisma.mcpServer.findUnique({
        where: { id: req.params.id },
        include: { agents: { include: { agent: true } } },
      })
      if (!server) throw new NotFoundError('McpServer', req.params.id)
      sendSuccess(reply, server)
    } catch (error) {
      sendError(reply, error)
    }
  })

  /**
   * POST /api/mcp-servers
   * Register a new external MCP server.
   *
   * Env vars are stored as-is — callers are responsible for not logging
   * the response in environments where the env object contains secrets.
   */
  app.post('/api/mcp-servers', async (req, reply) => {
    try {
      const body = CreateMcpServerSchema.parse(req.body)
      const server = await prisma.mcpServer.create({
        data: {
          name: body.name,
          description: body.description,
          type: body.type,
          command: body.command,
          args: body.args,
          // Store env as a JSON object in the db; omit the key when absent
          ...(body.env ? { env: body.env } : {}),
        },
      })
      sendSuccess(reply, server, 201)
    } catch (error) {
      sendError(reply, error)
    }
  })

  /**
   * PATCH /api/mcp-servers/:id
   * Update an MCP server definition (partial).
   */
  app.patch<{ Params: { id: string } }>('/api/mcp-servers/:id', async (req, reply) => {
    try {
      const existing = await prisma.mcpServer.findUnique({ where: { id: req.params.id } })
      if (!existing) throw new NotFoundError('McpServer', req.params.id)

      const body = UpdateMcpServerSchema.parse(req.body)

      // Build update payload — only include fields that were provided
      const updateData: Record<string, unknown> = {}
      if (body.name !== undefined) updateData['name'] = body.name
      if (body.description !== undefined) updateData['description'] = body.description
      if (body.type !== undefined) updateData['type'] = body.type
      if (body.command !== undefined) updateData['command'] = body.command
      if (body.args !== undefined) updateData['args'] = body.args
      if (body.env !== undefined) updateData['env'] = body.env

      const updated = await prisma.mcpServer.update({
        where: { id: req.params.id },
        data: updateData,
      })
      sendSuccess(reply, updated)
    } catch (error) {
      sendError(reply, error)
    }
  })

  /**
   * DELETE /api/mcp-servers/:id
   * Remove an MCP server. AgentMcpServer join rows are cascade-deleted
   * by the database constraint.
   */
  app.delete<{ Params: { id: string } }>('/api/mcp-servers/:id', async (req, reply) => {
    try {
      const existing = await prisma.mcpServer.findUnique({ where: { id: req.params.id } })
      if (!existing) throw new NotFoundError('McpServer', req.params.id)
      await prisma.mcpServer.delete({ where: { id: req.params.id } })
      sendSuccess(reply, { deleted: true })
    } catch (error) {
      sendError(reply, error)
    }
  })

  // -------------------------------------------------------------------------
  // Agent <-> MCP Server assignment
  // -------------------------------------------------------------------------

  /**
   * POST /api/agents/:agentId/mcp/:mcpServerId
   * Assign an MCP server to an agent.
   */
  app.post<{ Params: { agentId: string; mcpServerId: string } }>(
    '/api/agents/:agentId/mcp/:mcpServerId',
    async (req, reply) => {
      try {
        const { agentId, mcpServerId } = req.params

        const agent = await prisma.agent.findUnique({ where: { id: agentId } })
        if (!agent) throw new NotFoundError('Agent', agentId)

        const server = await prisma.mcpServer.findUnique({ where: { id: mcpServerId } })
        if (!server) throw new NotFoundError('McpServer', mcpServerId)

        const assignment = await prisma.agentMcpServer.upsert({
          where: { agentId_mcpServerId: { agentId, mcpServerId } },
          create: { agentId, mcpServerId },
          update: {},
          include: { mcpServer: true },
        })
        sendSuccess(reply, assignment, 201)
      } catch (error) {
        sendError(reply, error)
      }
    },
  )

  /**
   * DELETE /api/agents/:agentId/mcp/:mcpServerId
   * Unassign an MCP server from an agent.
   */
  app.delete<{ Params: { agentId: string; mcpServerId: string } }>(
    '/api/agents/:agentId/mcp/:mcpServerId',
    async (req, reply) => {
      try {
        const { agentId, mcpServerId } = req.params

        const existing = await prisma.agentMcpServer.findUnique({
          where: { agentId_mcpServerId: { agentId, mcpServerId } },
        })
        if (!existing) {
          throw new NotFoundError(
            `AgentMcpServer(agent=${agentId}, mcp=${mcpServerId})`,
            '',
          )
        }

        await prisma.agentMcpServer.delete({
          where: { agentId_mcpServerId: { agentId, mcpServerId } },
        })
        sendSuccess(reply, { deleted: true })
      } catch (error) {
        sendError(reply, error)
      }
    },
  )

  /**
   * GET /api/agents/:agentId/mcp
   * List all MCP servers assigned to an agent.
   */
  app.get<{ Params: { agentId: string } }>(
    '/api/agents/:agentId/mcp',
    async (req, reply) => {
      try {
        const { agentId } = req.params

        const agent = await prisma.agent.findUnique({ where: { id: agentId } })
        if (!agent) throw new NotFoundError('Agent', agentId)

        const assignments = await prisma.agentMcpServer.findMany({
          where: { agentId },
          include: { mcpServer: true },
        })
        type AssignmentWithServer = { mcpServer: Prisma.McpServerGetPayload<Record<string, never>> }
        sendSuccess(reply, assignments.map((a: AssignmentWithServer) => a.mcpServer))
      } catch (error) {
        sendError(reply, error)
      }
    },
  )
}
