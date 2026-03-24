import type { Server, Socket } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents, TokenUsage, ResolvedPolicy, AgentMode } from '@orchestra/shared'
import { prisma } from '../lib/prisma'
import { ProcessManager } from '../engine/process-manager'
import { buildSpawnConfig } from '../engine/prompt-builder'
import { classifyError } from '../engine/error-types'
import { resolvePolicy } from '../engine/policy-resolver'
import { checkToolUse } from '../engine/policy-checker'
import { ApprovalManager } from '../engine/approval-manager'
import { ModeratorEngine } from '../discussion/moderator'
import type { AgentRecord } from '../discussion/moderator'
import type { ParticipantRole, DiscussionFormat } from '@orchestra/shared'
import { LoopEngine } from '../engine/loop-engine'
import { ChainExecutor } from '../engine/chain-executor'
import { WorkflowAdvisor } from '../engine/advisor'
import { Planner } from '../engine/planner'
import type { PlannerAgent } from '../engine/planner'
import { SKILL_CATALOG } from '../skills/catalog'
import { recordActivity } from '../services/activity'
import type { ChainDefinition as ChainDefinitionPayload } from '@orchestra/shared'
import type { ChainDefinition } from '../engine/chain-executor'

// Tracks the active sessionId per agentId so we can emit back on the right channel
const agentSessionMap = new Map<string, string>()

// Tracks the resolved policy per agentId for the duration of a run
const agentPolicyMap = new Map<string, ResolvedPolicy>()

// Tracks the userId per agentId so callbacks can record activity with the correct user
const agentUserMap = new Map<string, string>()

// Tracks the pending approval id per agentId (at most one at a time)
const agentApprovalMap = new Map<string, string>()

// Tracks active ModeratorEngine instances by tableId
const activeDiscussions = new Map<string, ModeratorEngine>()

// Tracks active LoopEngine instances by agentId
const socketActiveLoops = new Map<string, LoopEngine>()

// Tracks active ChainExecutor instances by chainId
const socketActiveChains = new Map<string, ChainExecutor>()

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
          agentUserMap.delete(agentId)

          void Promise.all([
            prisma.agent.update({ where: { id: agentId }, data: { status: 'error' } }),
            prisma.agentSession.update({ where: { id: sessionId }, data: { endedAt: new Date() } }),
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

      void recordActivity({
        userId: agentUserMap.get(agentId),
        agentId,
        type: 'agent_completed',
        title: 'Agent completed',
        metadata: { sessionId, usage: tokenUsage },
      })

      agentSessionMap.delete(agentId)
      agentPolicyMap.delete(agentId)
      agentApprovalMap.delete(agentId)
      agentUserMap.delete(agentId)

      // Update agent status and close the session
      void Promise.all([
        prisma.agent.update({
          where: { id: agentId },
          data: { status: 'idle' },
        }),
        prisma.agentSession.update({
          where: { id: sessionId },
          data: { endedAt: new Date() },
        }),
      ]).catch(() => { /* best-effort */ })
    },

    onError(agentId, sessionId, err) {
      const classified = classifyError(err, agentId, sessionId)

      void recordActivity({
        userId: agentUserMap.get(agentId),
        agentId,
        type: 'agent_error',
        title: 'Agent error',
        detail: classified.userMessage,
        metadata: { sessionId, errorType: classified.type },
      })

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
      agentUserMap.delete(agentId)

      void Promise.all([
        prisma.agent.update({
          where: { id: agentId },
          data: { status: 'error' },
        }),
        prisma.agentSession.update({
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

    socket.on('discussion:start', (data) => {
      void handleDiscussionStart(socket, io, data)
    })

    socket.on('discussion:pause', (data) => {
      handleDiscussionPause(socket, io, data)
    })

    socket.on('discussion:resume', (data) => {
      void handleDiscussionResume(socket, io, data)
    })

    socket.on('loop:start', (data: { agentId: string; message: string }) => {
      void handleLoopStart(socket, io, data)
    })

    socket.on('loop:stop', (data: { agentId: string }) => {
      handleLoopStop(socket, io, data)
    })

    socket.on('loop:approve', (data: { agentId: string; loopId: string; approved: boolean }) => {
      handleLoopApprove(socket, data)
    })

    socket.on('agent:set_mode', (data: { agentId: string; mode: AgentMode }) => {
      void handleAgentSetMode(socket, io, processManager, approvalManager, data)
    })

    socket.on('chain:execute', (data: { chainId?: string; definition: ChainDefinitionPayload; initialMessage: string; workspaceId?: string; maestro?: boolean; planner?: boolean; plannerCustomInstructions?: string }) => {
      void handleChainExecute(socket, io, data)
    })

    socket.on('chain:stop', (data: { chainId: string }) => {
      handleChainStop(socket, io, data)
    })

    socket.on('chain:maestro_redirect_response', (data: { chainId: string; requestId: string; approved: boolean }) => {
      handleMaestroRedirectResponse(data)
    })

    socket.on('advisor:analyze', (data: { chainId: string; model?: string }) => {
      void handleAdvisorAnalyze(socket, io, data)
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
  data: { agentId: string; message: string; workspaceId?: string },
): Promise<void> {
  const { agentId, message, workspaceId } = data

  try {
    // Build the spawn configuration from the DB
    const config = await buildSpawnConfig(agentId, workspaceId)

    // Resolve effective policy for this agent (no session yet — session policies
    // are applied after the Session record is created and passed in future calls)
    const resolvedPolicy = await resolvePolicy(agentId)
    agentPolicyMap.set(agentId, resolvedPolicy)

    // Create a Session record in the DB
    const session = await prisma.agentSession.create({
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

    const userId = (socket.data as Record<string, unknown>)?.user
      ? ((socket.data as Record<string, unknown>).user as { id: string }).id
      : undefined
    agentUserMap.set(agentId, userId ?? '')

    void recordActivity({
      userId,
      agentId,
      workspaceId,
      type: 'agent_started',
      title: 'Agent started',
      metadata: { sessionId, model: config.model },
    })

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
      ...(config.addDirs && config.addDirs.length > 0 ? { addDirs: config.addDirs } : {}),
      verbose: true,
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
    agentUserMap.delete(agentId)

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
  agentUserMap.delete(agentId)

  io.emit('agent:status', { agentId, status: 'idle' })

  void Promise.all([
    prisma.agent.update({
      where: { id: agentId },
      data: { status: 'idle' },
    }),
    sessionId
      ? prisma.agentSession.update({
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

async function handleAgentSetMode(
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  processManager: ProcessManager,
  approvalManager: ApprovalManager,
  data: { agentId: string; mode: AgentMode },
): Promise<void> {
  const { agentId, mode } = data

  const validModes = new Set<AgentMode>(['plan', 'default', 'edit'])
  if (!validModes.has(mode)) {
    socket.emit('agent:error', {
      agentId,
      sessionId: '',
      error: `Invalid mode: ${mode}`,
      type: 'PROCESS_ERROR',
    })
    return
  }

  try {
    await prisma.agent.update({
      where: { id: agentId },
      data: { permissionMode: mode },
    })

    io.emit('agent:mode_changed', { agentId, mode })

    // If the agent is currently running, stop and re-start with the new mode
    const sessionId = agentSessionMap.get(agentId)
    if (sessionId) {
      // Cancel any pending approval
      const approvalId = agentApprovalMap.get(agentId)
      if (approvalId) {
        approvalManager.reject(approvalId)
        agentApprovalMap.delete(agentId)
      }

      processManager.stopAgent(agentId)
      agentSessionMap.delete(agentId)
      agentPolicyMap.delete(agentId)
      agentUserMap.delete(agentId)

      io.emit('agent:status', { agentId, status: 'idle' })

      void Promise.all([
        prisma.agent.update({
          where: { id: agentId },
          data: { status: 'idle' },
        }),
        prisma.agentSession.update({
          where: { id: sessionId },
          data: { endedAt: new Date() },
        }),
      ]).catch(() => { /* best-effort */ })
    }
  } catch (err) {
    socket.emit('agent:error', {
      agentId,
      sessionId: '',
      error: err instanceof Error ? err.message : 'Failed to update mode',
      type: 'PROCESS_ERROR',
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
// Discussion handler implementations
// ------------------------------------------------------------------

async function handleDiscussionStart(
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  data: { tableId: string },
): Promise<void> {
  const { tableId } = data

  if (activeDiscussions.has(tableId)) {
    socket.emit('agent:error', {
      agentId: tableId,
      sessionId: '',
      error: `Discussion ${tableId} is already running`,
      type: 'RESOURCE_ERROR',
    })
    return
  }

  try {
    const table = await prisma.discussionTable.findUnique({
      where: { id: tableId },
      include: {
        moderator: true,
        participants: { include: { agent: true } },
      },
    })

    if (!table) {
      socket.emit('agent:error', {
        agentId: tableId,
        sessionId: '',
        error: `Discussion table ${tableId} not found`,
        type: 'PROCESS_ERROR',
      })
      return
    }

    if (table.participants.length === 0) {
      socket.emit('agent:error', {
        agentId: tableId,
        sessionId: '',
        error: 'Cannot start discussion: no participants added',
        type: 'PROCESS_ERROR',
      })
      return
    }

    const participantsWithRoles = (table.participants as Array<{ agent: AgentRecord; role: string }>).map((p) => ({
      agent: p.agent,
      role: p.role as ParticipantRole,
    }))

    const engine = new ModeratorEngine(
      tableId,
      table.topic,
      table.format as DiscussionFormat,
      table.moderator as AgentRecord,
      participantsWithRoles,
      table.maxRounds,
    )

    // Forward engine events to all connected Socket.IO clients
    engine.on('turn', (round) => {
      const participant = participantsWithRoles.find((p: { agent: AgentRecord; role: ParticipantRole }) => p.agent.id === round.participantId)
      io.emit('discussion:turn', {
        tableId,
        agentName: round.participantName,
        role: participant?.role ?? 'participant',
        content: round.response,
      })
    })

    engine.on('moderator_decision', (decision) => {
      io.emit('discussion:moderator', {
        tableId,
        decision: decision.decision,
        reasoning: decision.reasoning,
      })
    })

    engine.on('concluded', (synthesis) => {
      activeDiscussions.delete(tableId)
      io.emit('discussion:concluded', { tableId, conclusion: synthesis })
    })

    engine.on('error', (err: Error) => {
      activeDiscussions.delete(tableId)
      io.emit('agent:error', {
        agentId: tableId,
        sessionId: '',
        error: err.message,
        type: 'PROCESS_ERROR',
      })
    })

    activeDiscussions.set(tableId, engine)

    // Start the engine — this is async and runs the full discussion loop
    engine.start().catch((err: unknown) => {
      activeDiscussions.delete(tableId)
      io.emit('agent:error', {
        agentId: tableId,
        sessionId: '',
        error: err instanceof Error ? err.message : 'Discussion failed to start',
        type: 'PROCESS_ERROR',
      })
    })
  } catch (err) {
    socket.emit('agent:error', {
      agentId: tableId,
      sessionId: '',
      error: err instanceof Error ? err.message : 'Failed to start discussion',
      type: 'PROCESS_ERROR',
    })
  }
}

function handleDiscussionPause(
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  data: { tableId: string },
): void {
  const { tableId } = data
  const engine = activeDiscussions.get(tableId)

  if (!engine) {
    socket.emit('agent:error', {
      agentId: tableId,
      sessionId: '',
      error: `No active discussion for table ${tableId}`,
      type: 'PROCESS_ERROR',
    })
    return
  }

  engine.pause()
  io.emit('agent:status', { agentId: tableId, status: 'paused' })

  void prisma.discussionTable
    .update({ where: { id: tableId }, data: { status: 'active' } })
    .catch(() => { /* best-effort */ })
}

async function handleDiscussionResume(
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  data: { tableId: string },
): Promise<void> {
  const { tableId } = data
  const engine = activeDiscussions.get(tableId)

  if (!engine) {
    socket.emit('agent:error', {
      agentId: tableId,
      sessionId: '',
      error: `No active discussion for table ${tableId}`,
      type: 'PROCESS_ERROR',
    })
    return
  }

  try {
    io.emit('agent:status', { agentId: tableId, status: 'running' })
    await engine.resume()
  } catch (err) {
    socket.emit('agent:error', {
      agentId: tableId,
      sessionId: '',
      error: err instanceof Error ? err.message : 'Failed to resume discussion',
      type: 'PROCESS_ERROR',
    })
  }
}

// ------------------------------------------------------------------
// Loop handler implementations
// ------------------------------------------------------------------

async function handleLoopStart(
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  data: { agentId: string; message: string },
): Promise<void> {
  const { agentId, message } = data

  if (socketActiveLoops.has(agentId)) {
    socket.emit('agent:error', {
      agentId,
      sessionId: '',
      error: `Agent ${agentId} already has a running loop`,
      type: 'RESOURCE_ERROR',
    })
    return
  }

  try {
    const agent = await prisma.agent.findUnique({ where: { id: agentId } })
    if (!agent) {
      socket.emit('agent:error', {
        agentId,
        sessionId: '',
        error: `Agent ${agentId} not found`,
        type: 'PROCESS_ERROR',
      })
      return
    }

    const engine = new LoopEngine(agentId)
    socketActiveLoops.set(agentId, engine)

    engine.on('iteration', (iterData) => {
      io.emit('agent:loop_iteration', {
        agentId,
        iteration: iterData.iteration,
        maxIterations: iterData.maxIterations,
      })
    })

    engine.on('progress', (progressData) => {
      io.emit('notification', {
        id: `loop-progress-${agentId}-${progressData.iteration}`,
        level: 'info',
        title: `Loop iteration ${progressData.iteration}: ${progressData.learning.slice(0, 80)}`,
        agentId,
      })
    })

    engine.on('manual_approval_required', (approvalData) => {
      io.emit('notification', {
        id: `loop-approval-${agentId}-${approvalData.loopId}`,
        level: 'action_required',
        title: `Loop iteration ${approvalData.iteration} requires manual approval`,
        agentId,
        actions: ['approve', 'reject'],
      })
    })

    engine.on('completed', (completedData) => {
      socketActiveLoops.delete(agentId)
      io.emit('notification', {
        id: `loop-completed-${agentId}`,
        level: 'info',
        title: `Loop completed after ${completedData.totalIterations} iterations`,
        agentId,
      })
      io.emit('agent:status', { agentId, status: 'idle' })
    })

    engine.on('failed', (failedData) => {
      socketActiveLoops.delete(agentId)
      io.emit('agent:error', {
        agentId,
        sessionId: '',
        error: `Loop failed at iteration ${failedData.iteration}: ${failedData.error}`,
        type: 'PROCESS_ERROR',
      })
      io.emit('agent:status', { agentId, status: 'error' })
    })

    io.emit('agent:status', { agentId, status: 'running' })

    engine.start(message).catch((err: unknown) => {
      socketActiveLoops.delete(agentId)
      io.emit('agent:error', {
        agentId,
        sessionId: '',
        error: err instanceof Error ? err.message : 'Loop failed to start',
        type: 'PROCESS_ERROR',
      })
    })
  } catch (err) {
    socket.emit('agent:error', {
      agentId,
      sessionId: '',
      error: err instanceof Error ? err.message : 'Failed to start loop',
      type: 'PROCESS_ERROR',
    })
  }
}

function handleLoopStop(
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  data: { agentId: string },
): void {
  const { agentId } = data
  const engine = socketActiveLoops.get(agentId)

  if (!engine) {
    socket.emit('agent:error', {
      agentId,
      sessionId: '',
      error: `No active loop for agent ${agentId}`,
      type: 'PROCESS_ERROR',
    })
    return
  }

  engine.stop()
  socketActiveLoops.delete(agentId)
  io.emit('agent:status', { agentId, status: 'idle' })
}

function handleLoopApprove(
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  data: { agentId: string; loopId: string; approved: boolean },
): void {
  const { agentId, loopId, approved } = data
  const engine = socketActiveLoops.get(agentId)

  if (!engine) {
    socket.emit('agent:error', {
      agentId,
      sessionId: '',
      error: `No active loop for agent ${agentId}`,
      type: 'PROCESS_ERROR',
    })
    return
  }

  engine.resolveManualApproval(loopId, approved)
}

// ------------------------------------------------------------------
// Chain handler implementations
// ------------------------------------------------------------------

async function handleChainExecute(
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  data: { chainId?: string; definition: ChainDefinitionPayload; initialMessage: string; workspaceId?: string; maestro?: boolean; maestroRigor?: number; maestroCustomInstructions?: string; planner?: boolean; plannerCustomInstructions?: string },
): Promise<void> {
  const chainId = data.chainId ?? `chain-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  if (socketActiveChains.has(chainId)) {
    socket.emit('agent:error', {
      agentId: chainId,
      sessionId: '',
      error: `Chain ${chainId} is already running`,
      type: 'RESOURCE_ERROR',
    })
    return
  }

  try {
    // Resolve workspace working directory if provided
    let cwd: string | undefined
    if (data.workspaceId) {
      const workspace = await prisma.workspace.findUnique({
        where: { id: data.workspaceId },
        select: { workingDirectory: true },
      })
      cwd = workspace?.workingDirectory ?? undefined
    }

    const executor = new ChainExecutor()
    socketActiveChains.set(chainId, executor)

    // Persist chain run to DB
    const stepCount = data.definition.steps.length
    await prisma.chainRun.create({
      data: {
        chainId,
        workspaceId: data.workspaceId ?? null,
        initialMessage: data.initialMessage.slice(0, 5000),
        totalSteps: stepCount,
        status: 'running',
      },
    }).catch(() => {}) // Non-fatal if DB write fails

    // Track per-step usage for DB persistence
    const stepUsageMap = new Map<number, { tokensIn: number; tokensOut: number; costUsd: number }>()

    executor.on('step_start', (stepData) => {
      io.emit('chain:step_start', {
        chainId,
        stepIndex: stepData.stepIndex,
        agentId: stepData.agentId,
        cwd: stepData.cwd,
      })
      io.emit('notification', {
        id: `chain-step-${chainId}-${stepData.stepIndex}`,
        level: 'info',
        title: `Chain step ${stepData.stepIndex} started (agent ${stepData.agentId})`,
      })
      // Create step record in DB
      prisma.chainStepResult.create({
        data: {
          chainRun: { connect: { chainId } },
          stepIndex: stepData.stepIndex,
          agentId: stepData.agentId,
          status: 'running',
        },
      }).catch(() => {})
    })

    executor.on('step_text', (stepData) => {
      io.emit('chain:step_text', { chainId, ...stepData })
    })

    executor.on('step_tool_use', (stepData) => {
      io.emit('chain:step_tool_use', { chainId, ...stepData })
    })

    executor.on('step_tool_result', (stepData) => {
      io.emit('chain:step_tool_result', { chainId, ...stepData })
    })

    executor.on('step_usage', (stepData) => {
      io.emit('chain:step_usage', { chainId, ...stepData })
      stepUsageMap.set(stepData.stepIndex, {
        tokensIn: stepData.usage.inputTokens,
        tokensOut: stepData.usage.outputTokens,
        costUsd: stepData.usage.estimatedCostUsd ?? 0,
      })
    })

    executor.on('step_complete', (stepData) => {
      const output = typeof stepData.output === 'string' ? stepData.output : JSON.stringify(stepData.output ?? '')
      io.emit('chain:step_complete', {
        chainId,
        stepIndex: stepData.stepIndex,
        agentId: stepData.agentId,
        output,
      })
      io.emit('notification', {
        id: `chain-step-done-${chainId}-${stepData.stepIndex}`,
        level: 'info',
        title: `Chain step ${stepData.stepIndex} completed`,
      })
      // Update step record in DB
      const usage = stepUsageMap.get(stepData.stepIndex)
      prisma.chainStepResult.updateMany({
        where: {
          chainRun: { chainId },
          stepIndex: stepData.stepIndex,
        },
        data: {
          output: output.slice(0, 50000),
          status: 'completed',
          completedAt: new Date(),
          ...(usage ?? {}),
        },
      }).catch(() => {})
    })

    executor.on('chain_complete', (completeData) => {
      socketActiveChains.delete(chainId)
      io.emit('chain:complete', {
        chainId,
        totalSteps: completeData.outputs.size,
      })
      io.emit('notification', {
        id: `chain-complete-${chainId}`,
        level: 'info',
        title: `Chain ${chainId} completed (${completeData.outputs.size} steps)`,
      })
      // Update chain run in DB
      prisma.chainRun.update({
        where: { chainId },
        data: { status: 'completed', completedAt: new Date() },
      }).catch(() => {})
    })

    executor.on('error', (errData) => {
      io.emit('chain:error', {
        chainId,
        stepIndex: errData.stepIndex,
        error: errData.error.slice(0, 200),
      })
      io.emit('notification', {
        id: `chain-error-${chainId}-${errData.stepIndex}`,
        level: 'error',
        title: `Chain step ${errData.stepIndex} failed: ${errData.error.slice(0, 80)}`,
      })
      // Mark step as failed in DB
      prisma.chainStepResult.updateMany({
        where: {
          chainRun: { chainId },
          stepIndex: errData.stepIndex,
        },
        data: { status: 'failed', completedAt: new Date() },
      }).catch(() => {})
    })

    // Maestro event forwarding
    executor.on('step_maestro_thinking', (stepData) => {
      // Emit a lightweight "thinking" event so the UI can show a spinner
      io.emit('chain:maestro_decision', {
        chainId,
        reasoning: 'Evaluating step output...',
        action: 'continue',
        targetAgentName: '',
        message: '',
      })
    })

    executor.on('step_maestro', (stepData) => {
      const { decision } = stepData
      io.emit('chain:maestro_decision', {
        chainId,
        reasoning: decision.reasoning,
        action: decision.action,
        targetAgentName: '',
        message: decision.message,
      })

      // Continuous planner: emit agent suggestions if any
      if (decision.agentSuggestions && decision.agentSuggestions.length > 0) {
        io.emit('chain:planner_result', {
          chainId,
          plan: {
            analysis: `Maestro suggests ${decision.agentSuggestions.length} agent improvement(s) during execution`,
            agentChanges: decision.agentSuggestions.map((s: any) => ({
              agentId: '',
              agentName: s.agentName,
              changes: s.changeType === 'model' ? { model: s.suggestion } : { persona: s.suggestion },
              reason: s.reason,
            })),
            edgeChanges: [],
            addAgents: [],
            removeAgents: [],
            approved: true,
          },
        })
      }
    })

    executor.on('step_maestro_redirect_request', (stepData) => {
      const { decision, requestId } = stepData
      // Look up agent names for display
      const steps = data.definition.steps
      const fromAgent = steps[stepData.stepIndex]?.agentId ?? 'unknown'
      const toAgent = steps[decision.targetStepIndex]?.agentId ?? 'unknown'

      io.emit('chain:maestro_redirect_request', {
        chainId,
        reasoning: decision.reasoning,
        fromAgent,
        toAgent,
        requestId,
      })
    })

    // ── Planner pre-execution analysis (if enabled) ──
    if (data.planner) {
      io.emit('chain:planner_start', { chainId })
      try {
        // Load agent metadata for planner context
        const plannerAgents: PlannerAgent[] = await Promise.all(
          data.definition.steps.map(async (step) => {
            const agent = await prisma.agent.findUnique({
              where: { id: step.agentId },
              select: { id: true, name: true, persona: true, model: true },
            })
            const skills = await prisma.agentSkill.findMany({
              where: { agentId: step.agentId, enabled: true },
              select: { skillId: true },
            })
            return {
              agentId: step.agentId,
              name: agent?.name ?? `Agent ${step.agentId.slice(0, 8)}`,
              persona: agent?.persona ?? '',
              model: agent?.model ?? 'sonnet',
              skills: skills.map((s) => s.skillId),
            }
          }),
        )

        const edges = data.definition.edges?.map((e) => ({
          from: data.definition.steps[e.from]?.agentId ?? '',
          to: data.definition.steps[e.to]?.agentId ?? '',
        })) ?? []

        const planner = new Planner()
        const plan = await planner.analyze({
          initialMessage: data.initialMessage,
          agents: plannerAgents,
          edges,
          customInstructions: data.plannerCustomInstructions,
        })

        io.emit('chain:planner_result', { chainId, plan })
      } catch (err) {
        // Planner failure is non-fatal — continue execution
        io.emit('chain:planner_error', {
          chainId,
          error: err instanceof Error ? err.message : 'Planner analysis failed',
        })
      }
    }

    executor.execute(data.definition as ChainDefinition, data.initialMessage, {
      cwd,
      workspaceId: data.workspaceId,
      maestro: data.maestro,
      maestroRigor: data.maestroRigor,
      maestroCustomInstructions: data.maestroCustomInstructions,
    }).catch((err: unknown) => {
      socketActiveChains.delete(chainId)
      io.emit('agent:error', {
        agentId: chainId,
        sessionId: '',
        error: err instanceof Error ? err.message : 'Chain execution failed',
        type: 'PROCESS_ERROR',
      })
      // Mark chain as failed in DB
      prisma.chainRun.update({
        where: { chainId },
        data: { status: 'failed', completedAt: new Date() },
      }).catch(() => {})
    })
  } catch (err) {
    socketActiveChains.delete(chainId)
    socket.emit('agent:error', {
      agentId: chainId,
      sessionId: '',
      error: err instanceof Error ? err.message : 'Failed to start chain',
      type: 'PROCESS_ERROR',
    })
  }
}

function handleChainStop(
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  data: { chainId: string },
): void {
  const { chainId } = data
  const executor = socketActiveChains.get(chainId)

  if (!executor) {
    socket.emit('agent:error', {
      agentId: chainId,
      sessionId: '',
      error: `No active chain ${chainId}`,
      type: 'PROCESS_ERROR',
    })
    return
  }

  executor.stop()
  socketActiveChains.delete(chainId)
  io.emit('notification', {
    id: `chain-stopped-${chainId}`,
    level: 'info',
    title: `Chain ${chainId} stopped`,
  })
}

// ------------------------------------------------------------------
// Advisor handler
// ------------------------------------------------------------------

async function handleAdvisorAnalyze(
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  data: { chainId: string; model?: string },
): Promise<void> {
  const { chainId } = data
  const model = data.model ?? 'claude-haiku-4-5-20251001'

  try {
    const chainRun = await prisma.chainRun.findUnique({
      where: { chainId },
      include: { steps: { orderBy: { stepIndex: 'asc' } } },
    })

    if (!chainRun || chainRun.status !== 'completed') {
      socket.emit('advisor:error', { chainId, error: 'No completed workflow run found for this chain.' })
      return
    }

    // Load agent metadata
    const agentIds = [...new Set(chainRun.steps.map((s) => s.agentId))]
    const agents = await prisma.agent.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true, persona: true },
    })
    const agentMap = new Map(agents.map((a) => [a.id, a]))

    io.emit('advisor:analyzing', { chainId })

    const advisor = new WorkflowAdvisor()
    const result = await advisor.analyze(
      {
        initialMessage: chainRun.initialMessage,
        agents: agents.map((a) => ({
          name: a.name,
          persona: a.persona ?? '',
          agentId: a.id,
        })),
        stepResults: chainRun.steps.map((s) => ({
          stepIndex: s.stepIndex,
          agentName: agentMap.get(s.agentId)?.name ?? s.agentName ?? s.agentId,
          agentId: s.agentId,
          output: s.output,
          tokensIn: s.tokensIn,
          tokensOut: s.tokensOut,
          status: s.status,
        })),
        availableSkills: SKILL_CATALOG.map((s) => ({
          name: s.name,
          description: s.description,
          category: s.category,
        })),
      },
      model,
    )

    io.emit('advisor:result', {
      chainId,
      result: {
        overallAssessment: result.overallAssessment,
        objectiveMet: result.objectiveMet,
        suggestions: result.suggestions.map((s) => ({
          id: s.id,
          category: s.category,
          title: s.title,
          description: s.description,
          actionType: s.actionType,
          actionPayload: s.actionPayload ? { ...s.actionPayload } : undefined,
          severity: s.severity,
        })),
      },
    })
  } catch (err) {
    socket.emit('advisor:error', {
      chainId,
      error: err instanceof Error ? err.message : 'Advisor analysis failed',
    })
  }
}

// ------------------------------------------------------------------
// Maestro redirect response handler
// ------------------------------------------------------------------

function handleMaestroRedirectResponse(
  data: { chainId: string; requestId: string; approved: boolean },
): void {
  const executor = socketActiveChains.get(data.chainId)
  if (executor) {
    executor.resolveRedirect(data.requestId, data.approved)
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
