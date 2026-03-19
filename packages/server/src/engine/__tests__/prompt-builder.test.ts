import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock Prisma before importing the module under test
// ---------------------------------------------------------------------------
vi.mock('../../lib/prisma', () => ({
  prisma: {
    agent: {
      findUnique: vi.fn(),
    },
    policy: {
      findMany: vi.fn(),
    },
  },
}))

// Mock mcp-config-builder so we don't hit Prisma through it
vi.mock('../mcp-config-builder', () => ({
  buildMcpConfig: vi.fn().mockResolvedValue({ mcpServers: {}, conflicts: [] }),
}))

// Mock fs/promises so we never touch the real filesystem
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}))

import { buildSpawnConfig } from '../prompt-builder'
import { prisma } from '../../lib/prisma'
import { readFile } from 'fs/promises'

const mockFindUnique = vi.mocked(prisma.agent.findUnique)
const mockPolicyFindMany = vi.mocked(prisma.policy.findMany)
const mockReadFile = vi.mocked(readFile)

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agent-1',
    name: 'Test Agent',
    persona: 'You are a helpful assistant.',
    purpose: null,
    model: null,
    memoryEnabled: false,
    allowedTools: [],
    memories: [],
    skills: [],
    policies: [],
    ...overrides,
  }
}

function makeSkillAttachment(name: string, path: string, content: string) {
  return {
    priority: 1,
    skill: { id: `skill-${name}`, name, path, mcpConfig: null },
    _content: content, // used in test setup only
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildSpawnConfig — agent not found', () => {
  it('throws an error when agent does not exist', async () => {
    mockFindUnique.mockResolvedValueOnce(null as never)
    mockPolicyFindMany.mockResolvedValueOnce([] as never)

    await expect(buildSpawnConfig('missing-agent')).rejects.toThrow("Agent 'missing-agent' not found")
  })
})

describe('buildSpawnConfig — system prompt construction', () => {
  beforeEach(() => {
    mockPolicyFindMany.mockResolvedValue([] as never)
    mockReadFile.mockRejectedValue(new Error('ENOENT'))
  })

  it('system prompt equals persona when no memories', async () => {
    const agent = makeAgent({ persona: 'I am a coder.' })
    mockFindUnique.mockResolvedValueOnce(agent as never)

    const result = await buildSpawnConfig('agent-1')
    expect(result.systemPrompt).toBe('I am a coder.')
  })

  it('appends memories to system prompt when memoryEnabled=true', async () => {
    const agent = makeAgent({
      persona: 'Base persona.',
      memoryEnabled: true,
      memories: [
        { key: 'language', value: 'TypeScript' },
        { key: 'style', value: 'functional' },
      ],
    })
    mockFindUnique.mockResolvedValueOnce(agent as never)

    const result = await buildSpawnConfig('agent-1')
    expect(result.systemPrompt).toContain('Base persona.')
    expect(result.systemPrompt).toContain('Agent Memory')
    expect(result.systemPrompt).toContain('language')
    expect(result.systemPrompt).toContain('TypeScript')
    expect(result.systemPrompt).toContain('style')
    expect(result.systemPrompt).toContain('functional')
  })

  it('does not add memory section when memoryEnabled=false', async () => {
    const agent = makeAgent({
      memoryEnabled: false,
      memories: [{ key: 'hidden', value: 'should not appear' }],
    })
    mockFindUnique.mockResolvedValueOnce(agent as never)

    const result = await buildSpawnConfig('agent-1')
    expect(result.systemPrompt).not.toContain('Agent Memory')
    expect(result.systemPrompt).not.toContain('hidden')
  })
})

describe('buildSpawnConfig — skill content in appendSystemPrompt', () => {
  beforeEach(() => {
    mockPolicyFindMany.mockResolvedValue([] as never)
  })

  it('appendSystemPrompt is undefined when no skills', async () => {
    mockFindUnique.mockResolvedValueOnce(makeAgent({ skills: [] }) as never)
    mockReadFile.mockRejectedValue(new Error('ENOENT'))

    const result = await buildSpawnConfig('agent-1')
    expect(result.appendSystemPrompt).toBeUndefined()
  })

  it('includes skill content in appendSystemPrompt when skill SKILL.md is readable', async () => {
    const skillContent = '# My Skill\nDo things well.'
    const skillAttachment = {
      priority: 1,
      skill: { id: 'skill-1', name: 'my-skill', path: '/skills/my-skill', mcpConfig: null },
    }
    const agent = makeAgent({ skills: [skillAttachment] })
    mockFindUnique.mockResolvedValueOnce(agent as never)
    // First readFile call succeeds with skill content
    mockReadFile.mockResolvedValueOnce(skillContent as never)

    const result = await buildSpawnConfig('agent-1')
    expect(result.appendSystemPrompt).toBeDefined()
    expect(result.appendSystemPrompt).toContain('my-skill')
    expect(result.appendSystemPrompt).toContain(skillContent)
  })

  it('omits appendSystemPrompt when skill file is not readable', async () => {
    const skillAttachment = {
      priority: 1,
      skill: { id: 'skill-1', name: 'bad-skill', path: '/skills/bad', mcpConfig: null },
    }
    const agent = makeAgent({ skills: [skillAttachment] })
    mockFindUnique.mockResolvedValueOnce(agent as never)
    // All three candidate paths (SKILL.md, skill.md, README.md) fail
    mockReadFile
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockRejectedValueOnce(new Error('ENOENT'))

    const result = await buildSpawnConfig('agent-1')
    expect(result.appendSystemPrompt).toBeUndefined()
  })
})

describe('buildSpawnConfig — model resolution', () => {
  beforeEach(() => {
    mockPolicyFindMany.mockResolvedValue([] as never)
    mockReadFile.mockRejectedValue(new Error('ENOENT'))
  })

  it('uses the explicit model from agent when set', async () => {
    const agent = makeAgent({ model: 'opus' })
    mockFindUnique.mockResolvedValueOnce(agent as never)

    const result = await buildSpawnConfig('agent-1')
    expect(result.model).toBe('claude-opus-4-5')
  })

  it('uses purpose-based recommendation when model is null', async () => {
    const agent = makeAgent({ model: null, purpose: 'analysis' })
    mockFindUnique.mockResolvedValueOnce(agent as never)

    const result = await buildSpawnConfig('agent-1')
    // analysis → opus
    expect(result.model).toBe('claude-opus-4-5')
  })

  it('defaults to sonnet when both model and purpose are null', async () => {
    const agent = makeAgent({ model: null, purpose: null })
    mockFindUnique.mockResolvedValueOnce(agent as never)

    const result = await buildSpawnConfig('agent-1')
    expect(result.model).toBe('claude-sonnet-4-5')
  })

  it('uses haiku model when purpose=chat', async () => {
    const agent = makeAgent({ model: null, purpose: 'chat' })
    mockFindUnique.mockResolvedValueOnce(agent as never)

    const result = await buildSpawnConfig('agent-1')
    expect(result.model).toBe('claude-haiku-4-5')
  })
})

describe('buildSpawnConfig — allowed tools', () => {
  beforeEach(() => {
    mockPolicyFindMany.mockResolvedValue([] as never)
    mockReadFile.mockRejectedValue(new Error('ENOENT'))
  })

  it('returns default tools when agent.allowedTools is empty', async () => {
    const agent = makeAgent({ allowedTools: [] })
    mockFindUnique.mockResolvedValueOnce(agent as never)

    const result = await buildSpawnConfig('agent-1')
    expect(result.allowedTools).toContain('Read')
    expect(result.allowedTools).toContain('Bash')
    expect(result.allowedTools.length).toBeGreaterThan(0)
  })

  it('uses agent allowedTools when explicitly set', async () => {
    const agent = makeAgent({ allowedTools: ['Read', 'Write'] })
    mockFindUnique.mockResolvedValueOnce(agent as never)

    const result = await buildSpawnConfig('agent-1')
    expect(result.allowedTools).toEqual(['Read', 'Write'])
  })
})

describe('buildSpawnConfig — policy merge applied to config', () => {
  beforeEach(() => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'))
  })

  it('applies permissionMode from a global policy', async () => {
    const agent = makeAgent()
    mockFindUnique.mockResolvedValueOnce(agent as never)
    mockPolicyFindMany.mockResolvedValueOnce([
      { level: 'global', agentId: null, rules: { permissionMode: 'plan' } },
    ] as never)

    const result = await buildSpawnConfig('agent-1')
    expect(result.permissionMode).toBe('plan')
  })

  it('applies most-restrictive maxBudgetUsd from policies', async () => {
    const agent = makeAgent({
      policies: [{ level: 'agent', agentId: 'agent-1', rules: { maxBudgetUsd: 20 } }],
    })
    mockFindUnique.mockResolvedValueOnce(agent as never)
    mockPolicyFindMany.mockResolvedValueOnce([
      { level: 'global', agentId: null, rules: { maxBudgetUsd: 50 } },
    ] as never)

    const result = await buildSpawnConfig('agent-1')
    expect(result.maxBudgetUsd).toBe(20)
  })

  it('maxBudgetUsd is undefined when no policy sets it', async () => {
    const agent = makeAgent()
    mockFindUnique.mockResolvedValueOnce(agent as never)
    mockPolicyFindMany.mockResolvedValueOnce([] as never)

    const result = await buildSpawnConfig('agent-1')
    expect(result.maxBudgetUsd).toBeUndefined()
  })
})
