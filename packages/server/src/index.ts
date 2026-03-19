import Fastify from 'fastify'
import cors from '@fastify/cors'
import { Server } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from '@orchestra/shared'
import { checkPrerequisites } from './lib/prerequisites'
import { agentRoutes } from './routes/agents'
import { skillRoutes } from './routes/skills'
import { policyRoutes } from './routes/policies'
import { sessionRoutes } from './routes/sessions'
import { discussionRoutes } from './routes/discussions'
import { canvasRoutes } from './routes/canvas'
import { approvalRoutes } from './routes/approvals'
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

  const app = Fastify({ logger: true })

  await app.register(cors, { origin: UI_ORIGIN })

  // Routes
  await app.register(agentRoutes)
  await app.register(skillRoutes)
  await app.register(policyRoutes)
  await app.register(sessionRoutes)
  await app.register(discussionRoutes)
  await app.register(canvasRoutes)
  await app.register(approvalRoutes(approvalManager))

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

  // Socket.IO setup
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(app.server, {
    cors: { origin: UI_ORIGIN },
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
