import { readFile } from 'fs/promises'
import { join } from 'path'
import { prisma } from '../lib/prisma'
import { recommendModel } from '@orchestra/shared'
import type { AgentPurpose, ModelTier } from '@orchestra/shared'

// Map ModelTier to the actual Claude model identifier used by the CLI
const MODEL_IDS: Record<ModelTier, string> = {
  opus: 'claude-opus-4-5',
  sonnet: 'claude-sonnet-4-5',
  haiku: 'claude-haiku-4-5',
}

// Default tool allowlist when the agent has no explicit configuration
const DEFAULT_TOOLS: readonly string[] = [
  'Read',
  'Write',
  'Edit',
  'Bash',
  'Glob',
  'Grep',
  'LS',
  'WebFetch',
  'TodoWrite',
  'TodoRead',
]

export interface BuildResult {
  readonly systemPrompt: string
  readonly appendSystemPrompt?: string
  readonly allowedTools: readonly string[]
  readonly model: string
  readonly permissionMode: string
  readonly maxBudgetUsd?: number
  readonly env: Record<string, string>
}

export async function buildSpawnConfig(agentId: string): Promise<BuildResult> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: {
      skills: {
        where: { enabled: true },
        orderBy: { priority: 'asc' },
        include: { skill: true },
      },
      policies: true,
      memories: true,
    },
  })

  if (!agent) {
    throw new Error(`Agent '${agentId}' not found`)
  }

  // ------------------------------------------------------------------
  // 1. System prompt: persona + memories
  // ------------------------------------------------------------------
  const memorySections: string[] = []
  if (agent.memoryEnabled && agent.memories.length > 0) {
    memorySections.push('\n\n## Agent Memory\n')
    for (const mem of agent.memories) {
      memorySections.push(`- **${mem.key}**: ${mem.value}`)
    }
  }

  const systemPrompt = [agent.persona, ...memorySections].join('')

  // ------------------------------------------------------------------
  // 2. Append prompt: enabled skills' SKILL.md content
  // ------------------------------------------------------------------
  const skillContents: string[] = []
  for (const agentSkill of agent.skills) {
    const skillContent = await loadSkillContent(agentSkill.skill.path)
    if (skillContent !== null) {
      skillContents.push(`\n\n## Skill: ${agentSkill.skill.name}\n${skillContent}`)
    }
  }

  const appendSystemPrompt =
    skillContents.length > 0 ? skillContents.join('\n') : undefined

  // ------------------------------------------------------------------
  // 3. Allowed tools
  // ------------------------------------------------------------------
  const allowedTools: string[] =
    agent.allowedTools.length > 0 ? [...agent.allowedTools] : [...DEFAULT_TOOLS]

  // ------------------------------------------------------------------
  // 4. Model resolution
  // ------------------------------------------------------------------
  let modelId: string
  if (agent.model) {
    modelId = MODEL_IDS[agent.model as ModelTier] ?? agent.model
  } else if (agent.purpose) {
    const rec = recommendModel(agent.purpose as AgentPurpose)
    modelId = MODEL_IDS[rec.tier]
  } else {
    modelId = MODEL_IDS.sonnet
  }

  // ------------------------------------------------------------------
  // 5. Policy resolution — merge global + agent-level policies
  // ------------------------------------------------------------------
  const globalPolicies = await prisma.policy.findMany({
    where: { level: 'global' },
  })

  const allPolicies = [...globalPolicies, ...agent.policies]

  let permissionMode = 'dontAsk'
  let maxBudgetUsd: number | undefined

  for (const policy of allPolicies) {
    const rules = policy.rules as {
      permissionMode?: string
      maxBudgetUsd?: number
    }

    if (rules.permissionMode) {
      // Agent-level policy overrides global
      if (policy.level === 'agent' || policy.agentId === agentId) {
        permissionMode = rules.permissionMode
      } else if (permissionMode === 'dontAsk') {
        permissionMode = rules.permissionMode
      }
    }

    if (rules.maxBudgetUsd !== undefined) {
      if (maxBudgetUsd === undefined || rules.maxBudgetUsd < maxBudgetUsd) {
        // Take the most restrictive budget limit
        maxBudgetUsd = rules.maxBudgetUsd
      }
    }
  }

  // ------------------------------------------------------------------
  // 6. Isolated env vars
  // ------------------------------------------------------------------
  const env: Record<string, string> = {}
  const anthropicKey = process.env['ANTHROPIC_API_KEY']
  if (anthropicKey) {
    env['ANTHROPIC_API_KEY'] = anthropicKey
  }

  return {
    systemPrompt,
    appendSystemPrompt,
    allowedTools,
    model: modelId,
    permissionMode,
    maxBudgetUsd,
    env,
  }
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

async function loadSkillContent(skillPath: string): Promise<string | null> {
  // Try SKILL.md in the skill directory first, then skill.md, then README.md
  const candidates = [
    join(skillPath, 'SKILL.md'),
    join(skillPath, 'skill.md'),
    join(skillPath, 'README.md'),
  ]

  for (const candidate of candidates) {
    try {
      const content = await readFile(candidate, 'utf8')
      return content
    } catch {
      // File not found — try next
    }
  }

  return null
}
