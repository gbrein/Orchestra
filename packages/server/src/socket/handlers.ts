import type { Server, Socket } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents, TokenUsage } from '@orchestra/shared'
import { prisma } from '../lib/prisma'
import { ProcessManager } from '../engine/process-manager'
import { buildSpawnConfig } from '../engine/prompt-builder'
import { classifyError } from '../engine/error-types'

// Tracks the active sessionId per agentId so we can emit back on the right channel
const agentSessionMap = new Map<string, string>()

export function registerSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  processManager: ProcessManager,
): void {
  // ------------------------------------------------------------------
  // Wire ProcessManager callbacks → broadcast to all connected clients
  // ------------------------------------------------------------------
  processManager.setCallbacks({
    onText(agentId, sessionId, data) {
      const payload = data as { content: string; partial: boolean }
      io.emit('agent:text', {
        agentId,
        sessionId,
        content: payload.content,
        partial: payload.partial,
      })
      // Persist partial=false messages to DB (complete text blocks)
      if (!payload.partial) {
        void saveMessage(sessionId, 'assistant', payload.content, null, data)
      }
    },

    onToolUse(agentId, sessionId, data) {
      const payload = data as { toolName: string; input: unknown; id: string }
      io.emit('agent:tool_use', {
        agentId,
        sessionId,
        toolName: payload.toolName,
        input: payload.input,
      })
      void saveMessage(sessionId, 'tool', `tool_use: ${payload.toolName}`, {
        toolName: payload.toolName,
        input: payload.input,
        output: null,
      }, data)
    },

    onToolResult(agentId, sessionId, data) {
      const payload = data as { toolName: string; output: unknown; toolUseId: string }
      io.emit('agent:tool_result', {
        agentId,
        sessionId,
        toolName: payload.toolName,
        output: payload.output,
      })
      void saveMessage(sessionId, 'tool', `tool_result: ${payload.toolName}`, {
        toolName: payload.toolName,
        input: null,
        output: payload.output,
      }, data)
    },

    onCompletion(agentId, sessionId, _exitCode, usage) {
      const tokenUsage: TokenUsage = usage ?? {
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
      }

      io.emit('agent:done', { agentId, sessionId, usage: tokenUsage })

      agentSessionMap.delete(agentId)

      // Update agent status and close the session
      void Promise.all([
        prisma.agent.update({
          where: { id: agentId },
          data: { status: 'idle' },
        }),
        prisma.session.update({
          where: { id: sessionId },
          data: { endedAt: new Date() },
        }),
      ]).catch(() => { /* best-effort */ })
    },

    onError(agentId, sessionId, err) {
      const classified = classifyError(err, agentId, sessionId)

      io.emit('agent:error', {
        agentId,
        sessionId,
        error: classified.userMessage,
        type: classified.type,
      })

      io.emit('agent:status', { agentId, status: 'error' })

      agentSessionMap.delete(agentId)

      void Promise.all([
        prisma.agent.update({
          where: { id: agentId },
          data: { status: 'error' },
        }),
        prisma.session.update({
          where: { id: sessionId },
          data: { endedAt: new Date() },
        }),
      ]).catch(() => { /* best-effort */ })
    },
  })

  // ------------------------------------------------------------------
  // Per-socket event handlers
  // ------------------------------------------------------------------
  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {

    socket.on('agent:start', (data) => {
      void handleAgentStart(socket, io, processManager, data)
    })

    socket.on('agent:stop', (data) => {
      handleAgentStop(socket, io, processManager, data)
    })

    socket.on('agent:message', (data) => {
      handleAgentMessage(socket, processManager, data)
    })
  })
}

// ------------------------------------------------------------------
// Handler implementations
// ------------------------------------------------------------------

async function handleAgentStart(
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  processManager: ProcessManager,
  data: { agentId: string; message: string },
): Promise<void> {
  const { agentId, message } = data

  try {
    // Build the spawn configuration from the DB
    const config = await buildSpawnConfig(agentId)

    // Create a Session record in the DB
    const session = await prisma.session.create({
      data: { agentId },
    })

    const sessionId = session.id
    agentSessionMap.set(agentId, sessionId)

    // Update agent status to running
    await prisma.agent.update({
      where: { id: agentId },
      data: { status: 'running' },
    })

    io.emit('agent:status', { agentId, status: 'running' })

    // Persist the user message
    await saveMessage(sessionId, 'user', message, null, null)

    // Start the agent process
    await processManager.startAgent({
      agentId,
      sessionId,
      message,
      systemPrompt: config.systemPrompt,
      appendSystemPrompt: config.appendSystemPrompt,
      allowedTools: config.allowedTools,
      model: config.model,
      permissionMode: config.permissionMode,
      maxBudgetUsd: config.maxBudgetUsd,
      env: config.env,
    })
  } catch (err) {
    const sessionId = agentSessionMap.get(agentId) ?? ''
    const classified = classifyError(err, agentId, sessionId || undefined)

    socket.emit('agent:error', {
      agentId,
      sessionId,
      error: classified.userMessage,
      type: classified.type,
    })

    socket.emit('agent:status', { agentId, status: 'error' })

    agentSessionMap.delete(agentId)

    // Best-effort status update
    void prisma.agent.update({
      where: { id: agentId },
      data: { status: 'error' },
    }).catch(() => { /* ignore */ })
  }
}

function handleAgentStop(
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  processManager: ProcessManager,
  data: { agentId: string },
): void {
  const { agentId } = data
  const sessionId = agentSessionMap.get(agentId) ?? ''

  processManager.stopAgent(agentId)
  agentSessionMap.delete(agentId)

  io.emit('agent:status', { agentId, status: 'idle' })

  void Promise.all([
    prisma.agent.update({
      where: { id: agentId },
      data: { status: 'idle' },
    }),
    sessionId
      ? prisma.session.update({
          where: { id: sessionId },
          data: { endedAt: new Date() },
        })
      : Promise.resolve(),
  ]).catch(() => { /* best-effort */ })

  void socket  // socket available if needed for ack
}

function handleAgentMessage(
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  processManager: ProcessManager,
  data: { agentId: string; message: string },
): void {
  const { agentId, message } = data

  try {
    processManager.sendMessage(agentId, message)

    const sessionId = agentSessionMap.get(agentId)
    if (sessionId) {
      void saveMessage(sessionId, 'user', message, null, null)
    }
  } catch (err) {
    const sessionId = agentSessionMap.get(agentId) ?? ''
    const classified = classifyError(err, agentId, sessionId || undefined)
    socket.emit('agent:error', {
      agentId,
      sessionId,
      error: classified.userMessage,
      type: classified.type,
    })
  }
}

// ------------------------------------------------------------------
// DB persistence helpers
// ------------------------------------------------------------------

async function saveMessage(
  sessionId: string,
  role: 'user' | 'assistant' | 'tool' | 'system',
  content: string,
  toolUse: { toolName: string; input: unknown; output: unknown } | null,
  rawEvent: unknown,
): Promise<void> {
  try {
    await prisma.message.create({
      data: {
        sessionId,
        role,
        content,
        toolUse: toolUse as object | undefined,
        rawEvent: rawEvent as object | undefined,
      },
    })
  } catch {
    // Non-fatal — session recording is best-effort
  }
}
