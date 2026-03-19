import type { Server, Socket } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents, TokenUsage, ResolvedPolicy } from '@orchestra/shared'
import { prisma } from '../lib/prisma'
import { ProcessManager } from '../engine/process-manager'
import { buildSpawnConfig } from '../engine/prompt-builder'
import { classifyError } from '../engine/error-types'
import { resolvePolicy } from '../engine/policy-resolver'
import { checkToolUse } from '../engine/policy-checker'
import { ApprovalManager } from '../engine/approval-manager'

// Tracks the active sessionId per agentId so we can emit back on the right channel
const agentSessionMap = new Map<string, string>()

// Tracks the resolved policy per agentId for the duration of a run
const agentPolicyMap = new Map<string, ResolvedPolicy>()

// Tracks the pending approval id per agentId (at most one at a time)
const agentApprovalMap = new Map<string, string>()

export function registerSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  processManager: ProcessManager,
  approvalManager: ApprovalManager,
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
      const resolvedPolicy = agentPolicyMap.get(agentId)

      if (resolvedPolicy) {
        const result = checkToolUse(payload.toolName, payload.input, resolvedPolicy)

        if (!result.allowed) {
          // Blocked — emit an error and stop the agent
          io.emit('agent:error', {
            agentId,
            sessionId,
            error: result.reason ?? 'Tool blocked by policy',
            type: 'POLICY_ERROR',
          })
          io.emit('agent:status', { agentId, status: 'error' })

          processManager.stopAgent(agentId)
          agentSessionMap.delete(agentId)
          agentPolicyMap.delete(agentId)

          void Promise.all([
            prisma.agent.update({ where: { id: agentId }, data: { status: 'error' } }),
            prisma.session.update({ where: { id: sessionId }, data: { endedAt: new Date() } }),
          ]).catch(() => { /* best-effort */ })

          return
        }

        if (result.requiresApproval) {
          // Pause the agent and request human approval
          const commandStr = extractCommandDisplay(payload.toolName, payload.input)

          const approvalId = approvalManager.requestApproval({
            agentId,
            sessionId,
            command: commandStr,
            description: `Tool "${payload.toolName}" requires approval: ${result.reason ?? ''}`,
            toolName: payload.toolName,
            toolInput: payload.input,
            timeoutMs: 5 * 60 * 1_000,
          })

          agentApprovalMap.set(agentId, approvalId)

          io.emit('agent:approval', {
            agentId,
            sessionId,
            command: commandStr,
            description: `Tool "${payload.toolName}" requires approval`,
          })

          io.emit('agent:status', { agentId, status: 'waiting_approval' })

          void prisma.agent
            .update({ where: { id: agentId }, data: { status: 'waiting_approval' } })
            .catch(() => { /* best-effort */ })

          // Record the tool_use event regardless
          void saveMessage(sessionId, 'tool', `tool_use: ${payload.toolName}`, {
            toolName: payload.toolName,
            input: payload.input,
            output: null,
          }, data)

          return
        }
      }

      // Allowed — forward to UI as normal
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
      agentPolicyMap.delete(agentId)
      agentApprovalMap.delete(agentId)

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
      agentPolicyMap.delete(agentId)
      agentApprovalMap.delete(agentId)

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
      void handleAgentStart(socket, io, processManager, approvalManager, data)
    })

    socket.on('agent:stop', (data) => {
      handleAgentStop(socket, io, processManager, approvalManager, data)
    })

    socket.on('agent:message', (data) => {
      handleAgentMessage(socket, processManager, data)
    })

    socket.on('approval:respond', (data) => {
      void handleApprovalRespond(io, processManager, approvalManager, data)
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
  approvalManager: ApprovalManager,
  data: { agentId: string; message: string },
): Promise<void> {
  const { agentId, message } = data

  try {
    // Build the spawn configuration from the DB
    const config = await buildSpawnConfig(agentId)

    // Resolve effective policy for this agent (no session yet — session policies
    // are applied after the Session record is created and passed in future calls)
    const resolvedPolicy = await resolvePolicy(agentId)
    agentPolicyMap.set(agentId, resolvedPolicy)

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

    // Start the agent process, honouring policy-derived settings
    await processManager.startAgent({
      agentId,
      sessionId,
      message,
      systemPrompt: config.systemPrompt,
      appendSystemPrompt: config.appendSystemPrompt,
      allowedTools: config.allowedTools,
      model: config.model,
      // Policy overrides config: use the most restrictive permission mode
      permissionMode: mergePermissionModeStrings(config.permissionMode, resolvedPolicy.permissionMode),
      // Policy overrides config: use the minimum budget
      maxBudgetUsd: minDefinedBudget(config.maxBudgetUsd, resolvedPolicy.maxBudgetUsd),
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
    agentPolicyMap.delete(agentId)

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
  approvalManager: ApprovalManager,
  data: { agentId: string },
): void {
  const { agentId } = data
  const sessionId = agentSessionMap.get(agentId) ?? ''

  // Cancel any pending approval for this agent
  const approvalId = agentApprovalMap.get(agentId)
  if (approvalId) {
    approvalManager.reject(approvalId)
    agentApprovalMap.delete(agentId)
  }

  processManager.stopAgent(agentId)
  agentSessionMap.delete(agentId)
  agentPolicyMap.delete(agentId)

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

async function handleApprovalRespond(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  processManager: ProcessManager,
  approvalManager: ApprovalManager,
  data: { agentId: string; approved: boolean; editedCommand?: string },
): Promise<void> {
  const { agentId, approved, editedCommand } = data
  const approvalId = agentApprovalMap.get(agentId)
  const sessionId = agentSessionMap.get(agentId) ?? ''

  if (!approvalId) {
    // No pending approval for this agent — nothing to do
    return
  }

  agentApprovalMap.delete(agentId)

  if (approved) {
    const approval = approvalManager.approve(approvalId)
    if (!approval) return

    // If the client provided an edited command, send it as a message
    if (editedCommand && editedCommand.trim().length > 0) {
      try {
        processManager.sendMessage(agentId, editedCommand)
      } catch {
        // Agent may have already completed — ignore
      }
    }

    io.emit('agent:status', { agentId, status: 'running' })

    void prisma.agent
      .update({ where: { id: agentId }, data: { status: 'running' } })
      .catch(() => { /* best-effort */ })
  } else {
    const approval = approvalManager.reject(approvalId)
    if (!approval) return

    // Notify the agent process that the tool was rejected
    try {
      processManager.sendMessage(
        agentId,
        `Tool use of "${approval.toolName}" was rejected by the user.`,
      )
    } catch {
      // Agent may have already completed — ignore
    }

    io.emit('agent:error', {
      agentId,
      sessionId,
      error: `Tool "${approval.toolName}" was rejected by the user.`,
      type: 'POLICY_ERROR',
    })

    io.emit('agent:status', { agentId, status: 'idle' })

    void prisma.agent
      .update({ where: { id: agentId }, data: { status: 'idle' } })
      .catch(() => { /* best-effort */ })
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

// ------------------------------------------------------------------
// Utility helpers
// ------------------------------------------------------------------

/**
 * Return the command portion of a tool invocation as a human-readable string.
 * Used for approval descriptions.
 */
function extractCommandDisplay(toolName: string, toolInput: unknown): string {
  if (
    toolName === 'Bash' &&
    toolInput !== null &&
    typeof toolInput === 'object' &&
    'command' in toolInput &&
    typeof (toolInput as Record<string, unknown>)['command'] === 'string'
  ) {
    return (toolInput as Record<string, string>)['command']
  }
  return toolName
}

/**
 * Merge two permission-mode strings, returning the more restrictive one.
 * Restrictiveness: default > plan > acceptEdits > dontAsk
 */
function mergePermissionModeStrings(a: string, b: string): string {
  const rank: Record<string, number> = {
    default: 3,
    plan: 2,
    acceptEdits: 1,
    dontAsk: 0,
  }
  return (rank[a] ?? 0) >= (rank[b] ?? 0) ? a : b
}

/**
 * Return the minimum of two optional budget values.
 * If both are defined, returns the smaller; if one is undefined, returns the other.
 */
function minDefinedBudget(a: number | undefined, b: number): number | undefined {
  if (a === undefined) return b
  return Math.min(a, b)
}
