// ChainExecutor — executes a directed acyclic graph (DAG) of agent steps.
// Validates for cycles before execution, runs independent branches in parallel,
// and passes predecessor output as input to each successive step.

import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import { buildSpawnConfig } from './prompt-builder'
import { ClaudeCodeSpawner } from './spawner'
import type { SpawnOptions } from './spawner'
import type { TokenUsage } from '@orchestra/shared'
import { Maestro } from './maestro'
import type { MaestroDecision, MaestroAgent, MaestroExecutionEntry } from './maestro'

export interface ChainStep {
  readonly agentId: string
  readonly config?: Partial<SpawnOptions>
  readonly conditions?: ReadonlyArray<{ pattern: string; targetStepIndex: number }>
}

export interface ChainEdge {
  readonly from: number
  readonly to: number
  readonly condition?: string
}

export interface ChainDefinition {
  readonly steps: readonly ChainStep[]
  readonly edges: readonly ChainEdge[]
}

export interface ChainExecuteOptions {
  readonly cwd?: string
  readonly workspaceId?: string
  readonly maestro?: boolean
}

export interface ChainExecutorEvents {
  step_start: (data: { stepIndex: number; agentId: string; cwd?: string }) => void
  step_text: (data: { stepIndex: number; agentId: string; content: string; partial: boolean }) => void
  step_tool_use: (data: { stepIndex: number; agentId: string; toolName: string; input: unknown; id: string }) => void
  step_tool_result: (data: { stepIndex: number; agentId: string; toolName: string; output: unknown; toolUseId: string }) => void
  step_usage: (data: { stepIndex: number; agentId: string; usage: TokenUsage }) => void
  step_complete: (data: { stepIndex: number; agentId: string; output: string }) => void
  step_maestro: (data: { decision: MaestroDecision; stepIndex: number }) => void
  step_maestro_thinking: (data: { stepIndex: number }) => void
  step_maestro_redirect_request: (data: { decision: MaestroDecision; stepIndex: number; requestId: string }) => void
  chain_complete: (data: { outputs: Map<number, string> }) => void
  error: (data: { stepIndex: number; error: string }) => void
}

export declare interface ChainExecutor {
  on<K extends keyof ChainExecutorEvents>(event: K, listener: ChainExecutorEvents[K]): this
  emit<K extends keyof ChainExecutorEvents>(event: K, ...args: Parameters<ChainExecutorEvents[K]>): boolean
}

export class ChainExecutor extends EventEmitter {
  private stopped = false
  private activeSpawners: ClaudeCodeSpawner[] = []
  private executionCwd?: string
  private executionWorkspaceId?: string
  private pendingRedirectResolvers = new Map<string, (approved: boolean) => void>()
  // Agent metadata loaded once for Maestro context
  private agentMetadata = new Map<string, MaestroAgent>()

  /** Resolve a pending Maestro redirect request (called from socket handler) */
  resolveRedirect(requestId: string, approved: boolean): void {
    const resolver = this.pendingRedirectResolvers.get(requestId)
    if (resolver) {
      this.pendingRedirectResolvers.delete(requestId)
      resolver(approved)
    }
  }

  async execute(chain: ChainDefinition, initialMessage: string, options?: ChainExecuteOptions): Promise<void> {
    this.stopped = false
    this.activeSpawners = []
    this.executionCwd = options?.cwd
    this.executionWorkspaceId = options?.workspaceId

    validateNoCycles(chain)

    // Route to Maestro-driven execution if enabled
    if (options?.maestro) {
      return this.executeMaestro(chain, initialMessage, options)
    }

    const outputs = new Map<number, string>()
    const stepCount = chain.steps.length

    if (stepCount === 0) {
      this.emit('chain_complete', { outputs })
      return
    }

    // Build adjacency lists
    const predecessors = buildPredecessorMap(chain)
    const successors = buildSuccessorMap(chain)

    // Topological order via Kahn's algorithm
    const topoOrder = topologicalSort(stepCount, predecessors)

    // Process in topological layers to allow parallel execution
    const completed = new Set<number>()
    const skipped = new Set<number>()

    let remaining = [...topoOrder]

    while (remaining.length > 0 && !this.stopped) {
      // Find all steps whose predecessors are completed (or skipped)
      const ready = remaining.filter((idx) => {
        const preds = predecessors.get(idx) ?? []
        return preds.every((p) => completed.has(p) || skipped.has(p))
      })

      if (ready.length === 0) break

      remaining = remaining.filter((idx) => !ready.includes(idx))

      // Determine which ready steps should actually run (vs. be skipped
      // because a conditional edge from the predecessor did not match)
      const toRun = ready.filter((idx) => {
        const preds = predecessors.get(idx) ?? []
        if (preds.length === 0) return true // root node — always run

        // A step runs if at least one non-conditional predecessor enables it,
        // OR if a conditional predecessor edge condition was met.
        for (const predIdx of preds) {
          if (skipped.has(predIdx)) continue

          const edgesFromPred = chain.edges.filter(
            (e) => e.from === predIdx && e.to === idx,
          )

          const hasCond = edgesFromPred.some((e) => e.condition !== undefined && e.condition.length > 0)
          if (!hasCond) return true // unconditional edge

          const predOutput = outputs.get(predIdx) ?? ''
          const conditionMet = edgesFromPred.some((e) => {
            if (!e.condition) return false
            try {
              return new RegExp(e.condition, 'i').test(predOutput)
            } catch {
              return false
            }
          })
          if (conditionMet) return true
        }
        return false
      })

      // Mark steps that are ready but not running as skipped
      for (const idx of ready) {
        if (!toRun.includes(idx)) {
          skipped.add(idx)
          // Cascade skip to all descendants that have no other path
          cascadeSkip(idx, successors, completed, skipped)
        }
      }

      if (toRun.length === 0) continue

      // Execute ready steps in parallel
      const results = await Promise.allSettled(
        toRun.map((stepIndex) =>
          this.runStep(chain.steps[stepIndex]!, stepIndex, predecessors, outputs, initialMessage),
        ),
      )

      for (let i = 0; i < results.length; i++) {
        const stepIndex = toRun[i]!
        const result = results[i]!

        if (result.status === 'fulfilled') {
          outputs.set(stepIndex, result.value)
          completed.add(stepIndex)
        } else {
          const errorMsg = result.reason instanceof Error
            ? result.reason.message
            : String(result.reason)
          this.emit('error', { stepIndex, error: errorMsg })
          // Mark this step and all its descendants as skipped so the chain
          // can continue with independent branches
          skipped.add(stepIndex)
          cascadeSkip(stepIndex, successors, completed, skipped)
        }
      }
    }

    if (!this.stopped) {
      this.emit('chain_complete', { outputs })
    }
  }

  // ------------------------------------------------------------------
  // Maestro-driven execution
  // ------------------------------------------------------------------

  private async executeMaestro(
    chain: ChainDefinition,
    initialMessage: string,
    options: ChainExecuteOptions,
  ): Promise<void> {
    const outputs = new Map<number, string>()
    const maestro = new Maestro()
    const agentIds = chain.steps.map((s) => s.agentId)

    // Load agent metadata for Maestro context
    await this.loadAgentMetadata(chain)

    const memories = await maestro.loadMemories(agentIds)

    const executionHistory: MaestroExecutionEntry[] = []
    const agents: MaestroAgent[] = chain.steps.map((step) => {
      const meta = this.agentMetadata.get(step.agentId)
      return meta ?? { name: step.agentId, persona: '' }
    })

    const MAX_RETRIES_PER_STEP = 2
    const retryCount = new Map<number, number>()

    let currentStepIndex = 0
    let currentMessage = initialMessage

    while (currentStepIndex < chain.steps.length && !this.stopped) {
      const step = chain.steps[currentStepIndex]!
      const retries = retryCount.get(currentStepIndex) ?? 0
      const isRetry = retries > 0

      // Run the step
      let output: string
      try {
        output = await this.runSingleStep(step, currentStepIndex, currentMessage)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        this.emit('error', { stepIndex: currentStepIndex, error: errorMsg })
        break
      }

      outputs.set(currentStepIndex, output)
      executionHistory.push({
        stepIndex: currentStepIndex,
        agentName: agents[currentStepIndex]?.name ?? step.agentId,
        output,
        wasRetry: isRetry,
      })

      // Maestro evaluates
      this.emit('step_maestro_thinking', { stepIndex: currentStepIndex })

      let decision: MaestroDecision
      try {
        decision = await maestro.evaluate({
          initialMessage,
          agents,
          executionHistory,
          currentStepOutput: output,
          completedStepIndex: currentStepIndex,
          totalSteps: chain.steps.length,
          memories,
        })
      } catch {
        // Maestro failed — fall through to linear execution
        decision = {
          action: currentStepIndex + 1 >= chain.steps.length ? 'conclude' : 'continue',
          targetStepIndex: currentStepIndex + 1,
          message: output,
          reasoning: 'Maestro evaluation failed. Continuing with default behavior.',
          learning: null,
        }
      }

      this.emit('step_maestro', { decision, stepIndex: currentStepIndex })

      // Save learning if present — attach to the first agent in the chain
      if (decision.learning && agentIds[0]) {
        void maestro.saveMemory(agentIds[0], decision.learning)
      }

      if (decision.action === 'redirect') {
        if (retries >= MAX_RETRIES_PER_STEP) {
          // Force continue — max retries exceeded
          this.emit('step_maestro', {
            decision: { ...decision, action: 'continue' as const, reasoning: `Max retries (${MAX_RETRIES_PER_STEP}) exceeded for this step. Continuing.` },
            stepIndex: currentStepIndex,
          })
        } else if (retries === 0) {
          // First redirect — auto-approve, no user prompt needed
          retryCount.set(currentStepIndex, retries + 1)
          currentStepIndex = decision.targetStepIndex
          currentMessage = ensureMessageHasContent(decision.message, output)
          continue
        } else {
          // Retry (2nd+ redirect on same step) — ask user
          const requestId = randomUUID()
          this.emit('step_maestro_redirect_request', {
            decision,
            stepIndex: currentStepIndex,
            requestId,
          })

          const approved = await this.waitForRedirectApproval(requestId)

          if (approved) {
            retryCount.set(currentStepIndex, retries + 1)
            currentStepIndex = decision.targetStepIndex
            currentMessage = ensureMessageHasContent(decision.message, output)
            continue
          }
        }
        // Declined or max retries — fall through to continue
      }

      if (decision.action === 'conclude') {
        break
      }

      // Continue to next step — ensure message includes output
      currentMessage = ensureMessageHasContent(decision.message, output)
      currentStepIndex++
    }

    if (!this.stopped) {
      this.emit('chain_complete', { outputs })
    }
  }

  private async loadAgentMetadata(chain: ChainDefinition): Promise<void> {
    const { prisma: db } = await import('../lib/prisma')
    const agentIds = chain.steps.map((s) => s.agentId)

    try {
      const agents = await db.agent.findMany({
        where: { id: { in: agentIds } },
        select: { id: true, name: true, persona: true },
      })

      for (const agent of agents) {
        this.agentMetadata.set(agent.id, {
          name: agent.name,
          persona: agent.persona ?? '',
        })
      }
    } catch {
      // Best-effort — names will fall back to IDs
    }
  }

  /** Run a single step without DAG logic (used by Maestro loop) */
  private async runSingleStep(
    step: ChainStep,
    stepIndex: number,
    message: string,
  ): Promise<string> {
    const config = await buildSpawnConfig(step.agentId, this.executionWorkspaceId)
    const sessionId = randomUUID()
    const cwd = this.executionCwd ?? config.cwd

    this.emit('step_start', { stepIndex, agentId: step.agentId, cwd })

    const spawner = new ClaudeCodeSpawner()
    this.activeSpawners.push(spawner)

    return new Promise<string>((resolve, reject) => {
      let fullOutput = ''

      spawner.on('text', (data: { content: string; partial: boolean }) => {
        if (data.partial) {
          fullOutput += data.content
        } else {
          fullOutput = data.content
        }
        this.emit('step_text', { stepIndex, agentId: step.agentId, content: data.content, partial: data.partial })
      })

      spawner.on('tool_use', (data: { toolName: string; input: unknown; id: string }) => {
        this.emit('step_tool_use', { stepIndex, agentId: step.agentId, toolName: data.toolName, input: data.input, id: data.id })
      })

      spawner.on('tool_result', (data: { toolName: string; output: unknown; toolUseId: string }) => {
        this.emit('step_tool_result', { stepIndex, agentId: step.agentId, toolName: data.toolName, output: data.output, toolUseId: data.toolUseId })
      })

      spawner.on('usage', (data: TokenUsage) => {
        this.emit('step_usage', { stepIndex, agentId: step.agentId, usage: data })
      })

      spawner.on('completion', () => {
        this.activeSpawners = this.activeSpawners.filter((s) => s !== spawner)
        this.emit('step_complete', { stepIndex, agentId: step.agentId, output: fullOutput })
        resolve(fullOutput)
      })

      spawner.on('error', (err: Error) => {
        this.activeSpawners = this.activeSpawners.filter((s) => s !== spawner)
        reject(new Error(`Step ${stepIndex} (agent ${step.agentId}) failed: ${err.message}`))
      })

      try {
        spawner.spawn({
          agentId: step.agentId,
          sessionId,
          message,
          systemPrompt: config.systemPrompt,
          appendSystemPrompt: config.appendSystemPrompt,
          allowedTools: config.allowedTools,
          model: config.model,
          permissionMode: config.permissionMode,
          maxBudgetUsd: config.maxBudgetUsd,
          env: config.env,
          cwd,
          ...step.config,
        })
      } catch (err) {
        this.activeSpawners = this.activeSpawners.filter((s) => s !== spawner)
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }

  private waitForRedirectApproval(requestId: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.pendingRedirectResolvers.set(requestId, resolve)

      // Auto-decline after 2 minutes if no response
      setTimeout(() => {
        if (this.pendingRedirectResolvers.has(requestId)) {
          this.pendingRedirectResolvers.delete(requestId)
          resolve(false)
        }
      }, 120_000)
    })
  }

  stop(): void {
    this.stopped = true
    for (const spawner of this.activeSpawners) {
      spawner.kill()
    }
    this.activeSpawners = []
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  private async runStep(
    step: ChainStep,
    stepIndex: number,
    predecessors: Map<number, number[]>,
    outputs: Map<number, string>,
    initialMessage: string,
  ): Promise<string> {
    const message = this.buildStepMessage(stepIndex, predecessors, outputs, initialMessage)
    const config = await buildSpawnConfig(step.agentId, this.executionWorkspaceId)
    const sessionId = randomUUID()
    const cwd = this.executionCwd ?? config.cwd

    this.emit('step_start', { stepIndex, agentId: step.agentId, cwd })

    const spawner = new ClaudeCodeSpawner()
    this.activeSpawners.push(spawner)

    return new Promise<string>((resolve, reject) => {
      let fullOutput = ''

      spawner.on('text', (data: { content: string; partial: boolean }) => {
        if (data.partial) {
          fullOutput += data.content
        } else {
          fullOutput = data.content
        }
        this.emit('step_text', { stepIndex, agentId: step.agentId, content: data.content, partial: data.partial })
      })

      spawner.on('tool_use', (data: { toolName: string; input: unknown; id: string }) => {
        this.emit('step_tool_use', { stepIndex, agentId: step.agentId, toolName: data.toolName, input: data.input, id: data.id })
      })

      spawner.on('tool_result', (data: { toolName: string; output: unknown; toolUseId: string }) => {
        this.emit('step_tool_result', { stepIndex, agentId: step.agentId, toolName: data.toolName, output: data.output, toolUseId: data.toolUseId })
      })

      spawner.on('usage', (data: TokenUsage) => {
        this.emit('step_usage', { stepIndex, agentId: step.agentId, usage: data })
      })

      spawner.on('completion', () => {
        this.activeSpawners = this.activeSpawners.filter((s) => s !== spawner)
        this.emit('step_complete', { stepIndex, agentId: step.agentId, output: fullOutput })
        resolve(fullOutput)
      })

      spawner.on('error', (err: Error) => {
        this.activeSpawners = this.activeSpawners.filter((s) => s !== spawner)
        reject(new Error(`Step ${stepIndex} (agent ${step.agentId}) failed: ${err.message}`))
      })

      try {
        spawner.spawn({
          agentId: step.agentId,
          sessionId,
          message,
          systemPrompt: config.systemPrompt,
          appendSystemPrompt: config.appendSystemPrompt,
          allowedTools: config.allowedTools,
          model: config.model,
          permissionMode: config.permissionMode,
          maxBudgetUsd: config.maxBudgetUsd,
          env: config.env,
          cwd,
          ...step.config,
        })
      } catch (err) {
        this.activeSpawners = this.activeSpawners.filter((s) => s !== spawner)
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }

  private buildStepMessage(
    stepIndex: number,
    predecessors: Map<number, number[]>,
    outputs: Map<number, string>,
    initialMessage: string,
  ): string {
    const preds = predecessors.get(stepIndex) ?? []

    if (preds.length === 0) {
      return initialMessage
    }

    const predOutputs = preds
      .filter((p) => outputs.has(p))
      .map((p) => outputs.get(p)!)

    if (predOutputs.length === 1) {
      return predOutputs[0]!
    }

    // Fan-in: concatenate all predecessor outputs
    return predOutputs
      .map((out, i) => `## Input from step ${preds[i]}\n${out}`)
      .join('\n\n')
  }
}

// ------------------------------------------------------------------
// Graph utilities
// ------------------------------------------------------------------

function buildPredecessorMap(chain: ChainDefinition): Map<number, number[]> {
  const map = new Map<number, number[]>()
  for (let i = 0; i < chain.steps.length; i++) {
    map.set(i, [])
  }
  for (const edge of chain.edges) {
    const preds = map.get(edge.to) ?? []
    preds.push(edge.from)
    map.set(edge.to, preds)
  }
  return map
}

function buildSuccessorMap(chain: ChainDefinition): Map<number, number[]> {
  const map = new Map<number, number[]>()
  for (let i = 0; i < chain.steps.length; i++) {
    map.set(i, [])
  }
  for (const edge of chain.edges) {
    const succs = map.get(edge.from) ?? []
    succs.push(edge.to)
    map.set(edge.from, succs)
  }
  return map
}

function topologicalSort(stepCount: number, predecessors: Map<number, number[]>): number[] {
  const inDegree = new Array<number>(stepCount).fill(0)
  for (let i = 0; i < stepCount; i++) {
    inDegree[i] = (predecessors.get(i) ?? []).length
  }

  const queue: number[] = []
  for (let i = 0; i < stepCount; i++) {
    if (inDegree[i] === 0) queue.push(i)
  }

  const order: number[] = []
  const successors = new Map<number, number[]>()
  for (let i = 0; i < stepCount; i++) {
    successors.set(i, [])
  }
  for (let i = 0; i < stepCount; i++) {
    for (const pred of predecessors.get(i) ?? []) {
      successors.get(pred)!.push(i)
    }
  }

  while (queue.length > 0) {
    const node = queue.shift()!
    order.push(node)
    for (const succ of successors.get(node) ?? []) {
      inDegree[succ]!--
      if (inDegree[succ] === 0) queue.push(succ)
    }
  }

  return order
}

export function validateNoCycles(chain: ChainDefinition): void {
  const stepCount = chain.steps.length
  const predecessors = buildPredecessorMap(chain)
  const order = topologicalSort(stepCount, predecessors)

  if (order.length !== stepCount) {
    throw new Error(
      `Chain contains a cycle. Only ${order.length} of ${stepCount} steps could be ordered. ` +
        'Ensure all edges form a DAG (directed acyclic graph).',
    )
  }
}

function cascadeSkip(
  startIdx: number,
  successors: Map<number, number[]>,
  completed: Set<number>,
  skipped: Set<number>,
): void {
  const queue = [...(successors.get(startIdx) ?? [])]
  while (queue.length > 0) {
    const idx = queue.shift()!
    if (completed.has(idx) || skipped.has(idx)) continue
    skipped.add(idx)
    queue.push(...(successors.get(idx) ?? []))
  }
}

/**
 * Ensures the Maestro's message includes the actual step output.
 * If the message is too short or empty, falls back to the raw output.
 */
function ensureMessageHasContent(message: string, stepOutput: string): string {
  if (!message || message.length < 50) {
    return stepOutput
  }
  return message
}
