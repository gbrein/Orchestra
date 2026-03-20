import type { Server, Socket } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents, TokenUsage, ResolvedPolicy } from '@orchestra/shared'
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
import type { ChainDefinition as ChainDefinitionPayload } from '@orchestra/shared'
import type { ChainDefinition } from '../engine/chain-executor'

// Tracks the active sessionId per agentId so we can emit back on the right channel
const agentSessionMap = new Map<string, string>()

// Tracks the resolved policy per agentId for the duration of a run
const agentPolicyMap = new Map<string, ResolvedPolicy>()

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

    socket.on('chain:execute', (data: { chainId?: string; definition: ChainDefinitionPayload; initialMessage: string }) => {
      void handleChainExecute(socket, io, data)
    })

    socket.on('chain:stop', (data: { chainId: string }) => {
      handleChainStop(socket, io, data)
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
      ...(config.addDirs && config.addDirs.length > 0 ? { addDirs: config.addDirs } : {}),
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
  data: { chainId?: string; definition: ChainDefinitionPayload; initialMessage: string },
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
    const executor = new ChainExecutor()
    socketActiveChains.set(chainId, executor)

    executor.on('step_start', (stepData) => {
      io.emit('notification', {
        id: `chain-step-${chainId}-${stepData.stepIndex}`,
        level: 'info',
        title: `Chain step ${stepData.stepIndex} started (agent ${stepData.agentId})`,
      })
    })

    executor.on('step_complete', (stepData) => {
      io.emit('notification', {
        id: `chain-step-done-${chainId}-${stepData.stepIndex}`,
        level: 'info',
        title: `Chain step ${stepData.stepIndex} completed`,
      })
    })

    executor.on('chain_complete', (completeData) => {
      socketActiveChains.delete(chainId)
      io.emit('notification', {
        id: `chain-complete-${chainId}`,
        level: 'info',
        title: `Chain ${chainId} completed (${completeData.outputs.size} steps)`,
      })
    })

    executor.on('error', (errData) => {
      io.emit('notification', {
        id: `chain-error-${chainId}-${errData.stepIndex}`,
        level: 'error',
        title: `Chain step ${errData.stepIndex} failed: ${errData.error.slice(0, 80)}`,
      })
    })

    executor.execute(data.definition as ChainDefinition, data.initialMessage).catch((err: unknown) => {
      socketActiveChains.delete(chainId)
      io.emit('agent:error', {
        agentId: chainId,
        sessionId: '',
        error: err instanceof Error ? err.message : 'Chain execution failed',
        type: 'PROCESS_ERROR',
      })
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
