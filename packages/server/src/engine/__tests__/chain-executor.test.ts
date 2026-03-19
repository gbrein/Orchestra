import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'

// ---------------------------------------------------------------------------
// Mock prompt-builder and spawner before importing the executor
// ---------------------------------------------------------------------------
vi.mock('../prompt-builder', () => ({
  buildSpawnConfig: vi.fn(),
}))

vi.mock('../spawner', () => {
  const { EventEmitter } = require('events')

  class MockClaudeCodeSpawner extends EventEmitter {
    public spawnCalled = false
    public killCalled = false

    spawn(_opts: unknown): void {
      this.spawnCalled = true
      // Immediately emit a non-partial text block then completion
      setImmediate(() => {
        this.emit('text', { content: 'step output', partial: false })
        this.emit('completion', { exitCode: 0 })
      })
    }

    kill(): void {
      this.killCalled = true
    }
  }

  return { ClaudeCodeSpawner: MockClaudeCodeSpawner }
})

import { ChainExecutor, validateNoCycles } from '../chain-executor'
import { buildSpawnConfig } from '../prompt-builder'
import type { ChainDefinition } from '../chain-executor'

const mockBuildSpawnConfig = vi.mocked(buildSpawnConfig)

// ---------------------------------------------------------------------------
// Default spawn config returned by the mock
// ---------------------------------------------------------------------------
const DEFAULT_CONFIG = {
  systemPrompt: 'Be helpful.',
  appendSystemPrompt: undefined,
  allowedTools: ['Read', 'Bash'],
  model: 'claude-sonnet-4-5',
  permissionMode: 'dontAsk',
  maxBudgetUsd: undefined,
  env: {},
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function linearChain(agentIds: string[]): ChainDefinition {
  const steps = agentIds.map((agentId) => ({ agentId }))
  const edges = agentIds
    .slice(0, -1)
    .map((_, i) => ({ from: i, to: i + 1 }))
  return { steps, edges }
}

function singleStep(agentId = 'agent-1'): ChainDefinition {
  return { steps: [{ agentId }], edges: [] }
}

// ---------------------------------------------------------------------------
// validateNoCycles — unit tests (pure graph logic, no mocks needed)
// ---------------------------------------------------------------------------

describe('validateNoCycles', () => {
  it('accepts an empty chain', () => {
    expect(() => validateNoCycles({ steps: [], edges: [] })).not.toThrow()
  })

  it('accepts a linear chain A→B→C', () => {
    expect(() => validateNoCycles(linearChain(['A', 'B', 'C']))).not.toThrow()
  })

  it('accepts a diamond chain A→B, A→C, B→D, C→D', () => {
    const chain: ChainDefinition = {
      steps: [{ agentId: 'A' }, { agentId: 'B' }, { agentId: 'C' }, { agentId: 'D' }],
      edges: [
        { from: 0, to: 1 },
        { from: 0, to: 2 },
        { from: 1, to: 3 },
        { from: 2, to: 3 },
      ],
    }
    expect(() => validateNoCycles(chain)).not.toThrow()
  })

  it('throws for a direct cycle A→B, B→A', () => {
    const chain: ChainDefinition = {
      steps: [{ agentId: 'A' }, { agentId: 'B' }],
      edges: [
        { from: 0, to: 1 },
        { from: 1, to: 0 },
      ],
    }
    expect(() => validateNoCycles(chain)).toThrow(/cycle/)
  })

  it('throws for a three-step cycle A→B→C→A', () => {
    const chain: ChainDefinition = {
      steps: [{ agentId: 'A' }, { agentId: 'B' }, { agentId: 'C' }],
      edges: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 0 },
      ],
    }
    expect(() => validateNoCycles(chain)).toThrow(/cycle/)
  })
})

// ---------------------------------------------------------------------------
// ChainExecutor — integration tests (using mocked spawner + prompt-builder)
// ---------------------------------------------------------------------------

describe('ChainExecutor — empty chain', () => {
  it('emits chain_complete immediately', async () => {
    const executor = new ChainExecutor()
    const events: unknown[] = []
    executor.on('chain_complete', (data) => events.push(data))

    await executor.execute({ steps: [], edges: [] }, 'hello')
    expect(events).toHaveLength(1)
    expect((events[0] as { outputs: Map<number, string> }).outputs.size).toBe(0)
  })
})

describe('ChainExecutor — linear chain', () => {
  beforeEach(() => {
    mockBuildSpawnConfig.mockResolvedValue(DEFAULT_CONFIG as never)
  })

  it('executes all steps and emits chain_complete', async () => {
    const chain = linearChain(['agent-A', 'agent-B', 'agent-C'])
    const executor = new ChainExecutor()

    const stepStarts: number[] = []
    const stepCompletes: number[] = []
    let chainCompleteData: { outputs: Map<number, string> } | null = null

    executor.on('step_start', ({ stepIndex }) => stepStarts.push(stepIndex))
    executor.on('step_complete', ({ stepIndex }) => stepCompletes.push(stepIndex))
    executor.on('chain_complete', (data) => { chainCompleteData = data })

    await executor.execute(chain, 'start message')

    expect(stepStarts).toHaveLength(3)
    expect(stepCompletes).toHaveLength(3)
    expect(chainCompleteData).not.toBeNull()
    expect(chainCompleteData!.outputs.size).toBe(3)
  })

  it('calls buildSpawnConfig for each agent', async () => {
    const chain = linearChain(['agent-A', 'agent-B'])
    const executor = new ChainExecutor()
    await executor.execute(chain, 'msg')

    expect(mockBuildSpawnConfig).toHaveBeenCalledWith('agent-A')
    expect(mockBuildSpawnConfig).toHaveBeenCalledWith('agent-B')
  })
})

describe('ChainExecutor — cycle detection at execute time', () => {
  it('throws before any step runs when chain has a cycle', async () => {
    const cyclicChain: ChainDefinition = {
      steps: [{ agentId: 'A' }, { agentId: 'B' }],
      edges: [{ from: 0, to: 1 }, { from: 1, to: 0 }],
    }

    const executor = new ChainExecutor()
    await expect(executor.execute(cyclicChain, 'hello')).rejects.toThrow(/cycle/)
  })
})

describe('ChainExecutor — parallel branches', () => {
  beforeEach(() => {
    mockBuildSpawnConfig.mockResolvedValue(DEFAULT_CONFIG as never)
  })

  it('executes independent branches after root step', async () => {
    // A → B, A → C  (B and C are independent)
    const chain: ChainDefinition = {
      steps: [{ agentId: 'A' }, { agentId: 'B' }, { agentId: 'C' }],
      edges: [
        { from: 0, to: 1 },
        { from: 0, to: 2 },
      ],
    }

    const executor = new ChainExecutor()
    const completes: number[] = []
    executor.on('step_complete', ({ stepIndex }) => completes.push(stepIndex))

    await executor.execute(chain, 'go')

    // All three steps should complete
    expect(completes).toHaveLength(3)
    expect(completes).toContain(0)
    expect(completes).toContain(1)
    expect(completes).toContain(2)
  })
})

describe('ChainExecutor — fan-in (multiple predecessors)', () => {
  beforeEach(() => {
    mockBuildSpawnConfig.mockResolvedValue(DEFAULT_CONFIG as never)
  })

  it('step D receives concatenated output from B and C', async () => {
    // A→B, A→C, B→D, C→D
    const chain: ChainDefinition = {
      steps: [
        { agentId: 'A' },
        { agentId: 'B' },
        { agentId: 'C' },
        { agentId: 'D' },
      ],
      edges: [
        { from: 0, to: 1 },
        { from: 0, to: 2 },
        { from: 1, to: 3 },
        { from: 2, to: 3 },
      ],
    }

    const executor = new ChainExecutor()
    let chainCompleteData: { outputs: Map<number, string> } | null = null
    executor.on('chain_complete', (data) => { chainCompleteData = data })

    await executor.execute(chain, 'start')

    // All four steps should produce output
    expect(chainCompleteData!.outputs.size).toBe(4)
    expect(chainCompleteData!.outputs.has(3)).toBe(true)
  })
})

describe('ChainExecutor — step failure isolation', () => {
  it('emits error event when buildSpawnConfig rejects for a step', async () => {
    // Make the first agentId fail at the config-build stage (before spawn)
    mockBuildSpawnConfig.mockImplementation(async (agentId: string) => {
      if (agentId === 'agent-fail') {
        throw new Error('config build failed for agent-fail')
      }
      return DEFAULT_CONFIG as never
    })

    // Two independent root nodes: step 0 and step 1 (no edges)
    const chain: ChainDefinition = {
      steps: [{ agentId: 'agent-fail' }, { agentId: 'agent-ok' }],
      edges: [],
    }

    const executor = new ChainExecutor()
    const errors: unknown[] = []
    executor.on('error', (data) => errors.push(data))

    await executor.execute(chain, 'go')

    expect(errors).toHaveLength(1)
    expect((errors[0] as { error: string }).error).toContain('agent-fail')

    // Reset mock back to default for other tests
    mockBuildSpawnConfig.mockResolvedValue(DEFAULT_CONFIG as never)
  })
})

describe('ChainExecutor — stop', () => {
  it('stops the executor without throwing', async () => {
    const executor = new ChainExecutor()
    // stop() before any execution — should be a no-op
    expect(() => executor.stop()).not.toThrow()
  })
})
