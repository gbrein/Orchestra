import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { Server } from 'socket.io'
import { createServer } from 'http'
import type { ClientToServerEvents, ServerToClientEvents } from '@orchestra/shared'
import { checkPrerequisites } from './lib/prerequisites'
import { agentRoutes } from './routes/agents'
import { skillRoutes } from './routes/skills'
import { policyRoutes } from './routes/policies'
import { sessionRoutes } from './routes/sessions'
import { discussionRoutes } from './routes/discussions'
import { canvasRoutes } from './routes/canvas'
import { approvalRoutes } from './routes/approvals'
import { mcpServerRoutes } from './routes/mcp-servers'
import { loopRoutes, activeLoops, activeChains, activePipelines } from './routes/loops'
import { resourceRoutes } from './routes/resources'
import { activityRoutes } from './routes/activity'
import { memoryRoutes } from './routes/memories'
import { analyticsRoutes } from './routes/analytics'
import { authRoutes } from './routes/auth'
import { registerAuthMiddleware } from './auth/middleware'
import { auth } from './auth/auth'
import { fromNodeHeaders } from 'better-auth/node'
import { ProcessManager } from './engine/process-manager'
import { ApprovalManager } from './engine/approval-manager'
import { registerSocketHandlers } from './socket/handlers'
import { ensureSkillsDirectory } from './skills/installer'

const PORT = parseInt(process.env.PORT ?? '3001', 10)
const UI_ORIGIN = process.env.UI_ORIGIN ?? 'http://localhost:3000'

async function main() {
  const processManager = new ProcessManager()
  const approvalManager = new ApprovalManager()

  // Ensure ~/.orchestra/skills/ exists before anything else touches the filesystem
  await ensureSkillsDirectory()

  // [G2] Prerequisites validation
  const prereqs = await checkPrerequisites()
  if (!prereqs.allPassed) {
    console.error('\n Prerequisites check failed:')
    for (const failure of prereqs.failures) {
      console.error(`  x ${failure.name}: ${failure.message}`)
      if (failure.fix) {
        console.error(`    -> Fix: ${failure.fix}`)
      }
    }
    if (prereqs.critical) {
      console.error('\nCritical prerequisites missing. Cannot start.')
      process.exit(1)
    }
    console.warn('\nStarting with warnings...\n')
  }

  // Create a raw HTTP server so Socket.IO can attach to it before Fastify starts
  const httpServer = createServer()

  const app = Fastify({ logger: true, serverFactory: (handler) => {
    httpServer.on('request', handler)
    return httpServer
  }})

  await app.register(cors, {
    origin: UI_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })

  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50 MB — matches MAX_FILE_SIZE in file-storage.ts
    },
  })

  // Auth routes (before middleware so /api/auth/* is accessible)
  await app.register(authRoutes)

  // Auth middleware — validates session on all non-public routes
  await registerAuthMiddleware(app)

  // Routes
  await app.register(agentRoutes)
  await app.register(skillRoutes)
  await app.register(policyRoutes)
  await app.register(sessionRoutes)
  await app.register(discussionRoutes)
  await app.register(canvasRoutes)
  await app.register(approvalRoutes(approvalManager))
  await app.register(mcpServerRoutes)
  await app.register(loopRoutes)
  await app.register(resourceRoutes)
  await app.register(activityRoutes)
  await app.register(memoryRoutes)
  await app.register(analyticsRoutes)

  // Health check
  app.get('/api/health', async () => ({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      prerequisites: prereqs,
      engine: {
        runningAgents: processManager.getRunningCount(),
        queuedAgents: processManager.getQueuedCount(),
        pendingApprovals: approvalManager.getPendingCount(),
      },
    },
  }))

  // Socket.IO setup — attach to the raw HTTP server (before Fastify listen)
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: UI_ORIGIN, methods: ['GET', 'POST'] },
  })

  // Socket.IO auth middleware — validate session cookie
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie
      if (!cookieHeader) {
        return next(new Error('Authentication required'))
      }
      const session = await auth.api.getSession({
        headers: fromNodeHeaders({ cookie: cookieHeader }),
      })
      if (!session) {
        return next(new Error('Invalid session'))
      }
      // Attach user to socket data for downstream use
      ;(socket.data as Record<string, unknown>).user = session.user
      next()
    } catch {
      next(new Error('Authentication failed'))
    }
  })

  io.on('connection', (socket) => {
    app.log.info(`Client connected: ${socket.id}`)

    socket.on('disconnect', () => {
      app.log.info(`Client disconnected: ${socket.id}`)
    })
  })

  // Register Claude Code engine socket handlers
  registerSocketHandlers(io, processManager, approvalManager)

  // Watchdog: auto-reject expired approvals every 10 s
  const approvalWatchdog = setInterval(() => {
    const expired = approvalManager.cleanupExpired()
    for (const approval of expired) {
      app.log.warn(
        { approvalId: approval.id, agentId: approval.agentId },
        'Approval timed out — auto-rejected',
      )
      io.emit('agent:error', {
        agentId: approval.agentId,
        sessionId: approval.sessionId,
        error: 'Approval request expired — no response received within the timeout.',
        type: 'APPROVAL_TIMEOUT',
      })
      io.emit('agent:status', { agentId: approval.agentId, status: 'idle' })
    }
  }, 10_000)
  approvalWatchdog.unref?.()

  // Graceful shutdown [G6]
  const shutdown = async () => {
    app.log.info('Shutting down gracefully...')
    clearInterval(approvalWatchdog)
    processManager.stopAll()

    for (const [, engine] of activeLoops) engine.stop()
    activeLoops.clear()
    for (const [, executor] of activeChains) executor.stop()
    activeChains.clear()
    for (const [, pipeline] of activePipelines) pipeline.stop()
    activePipelines.clear()

    io.close()
    await app.close()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  await app.listen({ port: PORT, host: '0.0.0.0' })
  console.log(`\nOrchestra server running on http://localhost:${PORT}`)
  console.log(`   Accepting connections from ${UI_ORIGIN}\n`)
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
