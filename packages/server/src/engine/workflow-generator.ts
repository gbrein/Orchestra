// WorkflowGenerator — analyzes a natural language task description and generates
// a complete multi-agent workflow with agents, edges, skills, and layout.

import { ClaudeCodeSpawner } from './spawner'
import { SKILL_CATALOG } from '../skills/catalog'
import { randomUUID } from 'crypto'
import type {
  GeneratedWorkflow,
  GeneratedWorkflowWithLayout,
  GeneratedAgent,
  GeneratedAgentWithPosition,
  GeneratedEdge,
  AgentPurpose,
  ModelTier,
} from '@orchestra/shared'

// ─── Valid values for validation ────────────────────────────────────────────

const VALID_PURPOSES = new Set<AgentPurpose>([
  'writing', 'coding', 'analysis', 'chat', 'review',
  'research', 'creative', 'data', 'general',
])

const VALID_MODELS = new Set<ModelTier>(['opus', 'sonnet', 'haiku'])

const VALID_SKILL_IDS = new Set(SKILL_CATALOG.map((s) => s.id))

// ─── WorkflowGenerator Class ────────────────────────────────────────────────

export class WorkflowGenerator {
  async generate(description: string): Promise<GeneratedWorkflowWithLayout> {
    const systemPrompt = buildSystemPrompt()
    const userMessage = `Task description:\n"${description}"\n\nAnalyze this task and generate a workflow. Respond with JSON only.`

    const spawner = new ClaudeCodeSpawner()
    const output = await this.spawnAndCollect(spawner, systemPrompt, userMessage)
    const workflow = parseGeneratorResponse(output, description)
    return applyLayout(workflow)
  }

  private spawnAndCollect(
    spawner: ClaudeCodeSpawner,
    systemPrompt: string,
    message: string,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let allText = ''      // accumulate ALL text events unconditionally
      let resultText = ''   // keep the 'result' event content separately

      spawner.on('text', (data: { content: string; partial: boolean }) => {
        allText += data.content
        if (!data.partial) {
          // Last non-partial text wins — usually the 'result' event
          resultText = data.content
        }
      })

      spawner.on('completion', () => {
        // Try sources in order of reliability:
        // 1. resultText (from 'result' event — usually the complete response)
        // 2. allText (everything accumulated — may have duplicates but nothing lost)
        const output = extractJson(resultText) ? resultText
          : extractJson(allText) ? allText
          : resultText || allText
        console.log('[WorkflowGenerator] output length:', output.length,
          'resultText length:', resultText.length,
          'allText length:', allText.length)
        resolve(output)
      })

      spawner.on('error', (err: Error) => {
        console.error('[WorkflowGenerator] spawn error:', err.message)
        reject(new Error(`Workflow generation failed: ${err.message}`))
      })

      try {
        spawner.spawn({
          agentId: `wfgen-${randomUUID().slice(0, 8)}`,
          sessionId: randomUUID(),
          message,
          systemPrompt,
          model: 'sonnet',
          permissionMode: 'plan',
          maxBudgetUsd: 0.15,
          verbose: false,
        })
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }
}

// ─── Prompt Construction ────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  const skillsList = SKILL_CATALOG
    .map((s) => `  - **${s.id}** (${s.category}): ${s.description}`)
    .join('\n')

  const purposes = [...VALID_PURPOSES].join(', ')

  return `You are a Workflow Architect — an expert at decomposing tasks into multi-agent workflows.

## Your Job
Analyze the user's task description and design a workflow with 2-5 specialized agents that collaborate to complete the task.

## Agent Design Rules
- Each agent must have a SPECIFIC role — no generic "helper" agents
- Write DETAILED personas (3-5 sentences) explaining the agent's expertise, approach, and responsibilities
- Pick the best purpose from: ${purposes}
- Pick the best model:
  - **opus** — for deep analysis, code review, complex reasoning
  - **sonnet** — for coding, writing, most tasks (best default)
  - **haiku** — for simple/fast tasks like formatting, summarizing
- Assign skills from the catalog when relevant (use EXACT skill IDs)

## Available Skills (use ONLY these IDs)
${skillsList}

## Edge Design Rules
- Edges define execution ORDER (a DAG — no cycles)
- Use "from" and "to" with agent tempIds (e.g., "agent-0" → "agent-1")
- Optional: add a "condition" regex if the next step should only run when the output matches a pattern

## Maestro
- Set maestroEnabled to true when the workflow has 3+ agents or needs intelligent coordination
- Set to false for simple 2-agent linear workflows

## Response Format
You MUST respond with ONLY a JSON object (no markdown, no code fences):
{
  "name": "<short workflow name, 3-5 words>",
  "agents": [
    {
      "tempId": "agent-0",
      "name": "<agent name>",
      "description": "<one sentence description>",
      "persona": "<detailed persona: expertise, approach, responsibilities>",
      "purpose": "<one of: ${purposes}>",
      "model": "<opus | sonnet | haiku>",
      "suggestedSkills": ["<skill-id>"]
    }
  ],
  "edges": [
    { "from": "agent-0", "to": "agent-1" }
  ],
  "maestroEnabled": true | false
}`
}

// ─── JSON Extraction ────────────────────────────────────────────────────────

function extractJson(raw: string): string | null {
  if (!raw) return null
  // Strip markdown code fences
  const stripped = raw.replace(/```(?:json)?\s*/g, '').replace(/```/g, '')

  // Find first { and match balanced braces
  const start = stripped.indexOf('{')
  if (start === -1) return null

  let depth = 0
  for (let i = start; i < stripped.length; i++) {
    if (stripped[i] === '{') depth++
    else if (stripped[i] === '}') depth--
    if (depth === 0) {
      return stripped.slice(start, i + 1)
    }
  }
  return null
}

// ─── Response Parsing ───────────────────────────────────────────────────────

function parseGeneratorResponse(raw: string, description: string): GeneratedWorkflow {
  const jsonStr = extractJson(raw)
  if (!jsonStr) {
    console.warn('[WorkflowGenerator] no JSON found in output. Raw (first 500 chars):', raw.slice(0, 500))
    return fallbackWorkflow(description)
  }

  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>

    const name = typeof parsed.name === 'string' && parsed.name.length > 0
      ? parsed.name
      : 'Generated Workflow'

    const rawAgents = Array.isArray(parsed.agents) ? parsed.agents : []
    const agents: GeneratedAgent[] = rawAgents
      .slice(0, 5)
      .map((a: unknown, i: number) => parseAgent(a, i))
      .filter((a): a is GeneratedAgent => a !== null)

    if (agents.length === 0) {
      console.warn('[WorkflowGenerator] parsed JSON but no valid agents found')
      return fallbackWorkflow(description)
    }

    const agentIds = new Set(agents.map((a) => a.tempId))

    const rawEdges = Array.isArray(parsed.edges) ? parsed.edges : []
    const edges: GeneratedEdge[] = rawEdges
      .map((e: unknown) => parseEdge(e, agentIds))
      .filter((e): e is GeneratedEdge => e !== null)

    const maestroEnabled = typeof parsed.maestroEnabled === 'boolean'
      ? parsed.maestroEnabled
      : agents.length >= 3

    console.log('[WorkflowGenerator] parsed workflow:', name, `(${agents.length} agents, ${edges.length} edges)`)
    return { name, agents, edges, maestroEnabled }
  } catch (err) {
    console.error('[WorkflowGenerator] JSON parse error:', err instanceof Error ? err.message : err)
    return fallbackWorkflow(description)
  }
}

function parseAgent(raw: unknown, index: number): GeneratedAgent | null {
  if (typeof raw !== 'object' || raw === null) return null
  const a = raw as Record<string, unknown>

  const name = typeof a.name === 'string' && a.name.length > 0
    ? a.name
    : null
  if (!name) return null

  const tempId = typeof a.tempId === 'string' ? a.tempId : `agent-${index}`
  const description = typeof a.description === 'string' ? a.description : name
  const persona = typeof a.persona === 'string' && a.persona.length > 0
    ? a.persona
    : `You are ${name}. ${description}`

  const purpose: AgentPurpose = typeof a.purpose === 'string' && VALID_PURPOSES.has(a.purpose as AgentPurpose)
    ? a.purpose as AgentPurpose
    : 'general'

  const model: ModelTier = typeof a.model === 'string' && VALID_MODELS.has(a.model as ModelTier)
    ? a.model as ModelTier
    : 'sonnet'

  const rawSkills = Array.isArray(a.suggestedSkills) ? a.suggestedSkills : []
  const suggestedSkills = rawSkills
    .filter((s): s is string => typeof s === 'string' && VALID_SKILL_IDS.has(s))

  return { tempId, name, description, persona, purpose, model, suggestedSkills }
}

function parseEdge(raw: unknown, validIds: Set<string>): GeneratedEdge | null {
  if (typeof raw !== 'object' || raw === null) return null
  const e = raw as Record<string, unknown>

  const from = typeof e.from === 'string' ? e.from : null
  const to = typeof e.to === 'string' ? e.to : null

  if (!from || !to || !validIds.has(from) || !validIds.has(to)) return null
  if (from === to) return null

  const condition = typeof e.condition === 'string' && e.condition.length > 0
    ? e.condition
    : undefined

  return { from, to, condition }
}

function fallbackWorkflow(description: string): GeneratedWorkflow {
  const name = description.length > 30 ? description.slice(0, 30) + '...' : description
  return {
    name,
    agents: [{
      tempId: 'agent-0',
      name: name,
      description,
      persona: `You are a helpful assistant. The user described the task as: "${description}". Follow these instructions carefully.`,
      purpose: 'general',
      model: 'sonnet',
      suggestedSkills: [],
    }],
    edges: [],
    maestroEnabled: false,
  }
}

// ─── Layout Algorithm ───────────────────────────────────────────────────────

function applyLayout(workflow: GeneratedWorkflow): GeneratedWorkflowWithLayout {
  const { agents, edges } = workflow

  if (agents.length === 0) {
    return { ...workflow, agents: [] }
  }

  // Build adjacency for topological layering
  const successors = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  for (const agent of agents) {
    successors.set(agent.tempId, [])
    inDegree.set(agent.tempId, 0)
  }

  for (const edge of edges) {
    successors.get(edge.from)?.push(edge.to)
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1)
  }

  // Kahn's algorithm for topological layers
  const layers: string[][] = []
  let queue = agents
    .map((a) => a.tempId)
    .filter((id) => (inDegree.get(id) ?? 0) === 0)

  while (queue.length > 0) {
    layers.push([...queue])
    const nextQueue: string[] = []

    for (const id of queue) {
      for (const succ of successors.get(id) ?? []) {
        const newDeg = (inDegree.get(succ) ?? 1) - 1
        inDegree.set(succ, newDeg)
        if (newDeg === 0) {
          nextQueue.push(succ)
        }
      }
    }

    queue = nextQueue
  }

  // Assign any remaining agents (cycles or disconnected) to last layer
  const layered = new Set(layers.flat())
  const remaining = agents.filter((a) => !layered.has(a.tempId)).map((a) => a.tempId)
  if (remaining.length > 0) {
    layers.push(remaining)
  }

  // Position: left-to-right, 350px per layer, 200px vertical gap
  const positionMap = new Map<string, { x: number; y: number }>()
  const startX = 100
  const layerGap = 350
  const nodeGap = 200
  const centerY = 300

  for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
    const layer = layers[layerIdx]!
    const x = startX + layerIdx * layerGap
    const totalHeight = (layer.length - 1) * nodeGap
    const startY = centerY - totalHeight / 2

    for (let nodeIdx = 0; nodeIdx < layer.length; nodeIdx++) {
      positionMap.set(layer[nodeIdx]!, { x, y: startY + nodeIdx * nodeGap })
    }
  }

  const agentsWithPosition: GeneratedAgentWithPosition[] = agents.map((agent) => ({
    ...agent,
    position: positionMap.get(agent.tempId) ?? { x: startX, y: centerY },
  }))

  return { ...workflow, agents: agentsWithPosition }
}
