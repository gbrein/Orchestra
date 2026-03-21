// Maestro — intelligent workflow orchestrator that contextualizes messages
// between chain steps, evaluates output quality, and can redirect or conclude.

import { ClaudeCodeSpawner } from './spawner'
import { prisma } from '../lib/prisma'
import { randomUUID } from 'crypto'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MaestroAgent {
  readonly name: string
  readonly persona: string
}

export interface MaestroExecutionEntry {
  readonly stepIndex: number
  readonly agentName: string
  readonly output: string
  readonly wasRetry: boolean
}

export interface MaestroContext {
  readonly initialMessage: string
  readonly agents: readonly MaestroAgent[]
  readonly executionHistory: readonly MaestroExecutionEntry[]
  readonly currentStepOutput: string
  readonly completedStepIndex: number
  readonly totalSteps: number
  readonly memories: readonly string[]
  readonly rigor?: number
  readonly customInstructions?: string
}

export type MaestroAction = 'continue' | 'redirect' | 'conclude'

export interface MaestroDecision {
  readonly action: MaestroAction
  readonly targetStepIndex: number
  readonly message: string
  readonly reasoning: string
  readonly learning: string | null
}

// ─── Maestro Class ──────────────────────────────────────────────────────────

export class Maestro {
  async evaluate(context: MaestroContext): Promise<MaestroDecision> {
    const systemPrompt = buildMaestroSystemPrompt(context)
    const userMessage = buildMaestroUserMessage(context)

    const spawner = new ClaudeCodeSpawner()
    const output = await this.spawnAndCollect(spawner, systemPrompt, userMessage)
    return parseMaestroResponse(output, context)
  }

  async loadMemories(agentIds: readonly string[]): Promise<readonly string[]> {
    if (agentIds.length === 0) return []
    try {
      const memories = await prisma.memory.findMany({
        where: {
          key: { startsWith: 'maestro:learning:' },
          agentId: { in: [...agentIds] },
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      })
      return memories.map((m) => m.value)
    } catch {
      return []
    }
  }

  async saveMemory(agentId: string, learning: string): Promise<void> {
    try {
      const key = `maestro:learning:${Date.now()}`
      await prisma.memory.create({
        data: {
          agentId,
          key,
          value: learning.slice(0, 2000),
        },
      })
    } catch {
      // Best-effort — don't fail the workflow for a memory save
    }
  }

  private spawnAndCollect(
    spawner: ClaudeCodeSpawner,
    systemPrompt: string,
    message: string,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let output = ''

      spawner.on('text', (data: { content: string; partial: boolean }) => {
        if (data.partial) {
          output += data.content
        } else {
          output = data.content
        }
      })

      spawner.on('completion', () => {
        resolve(output)
      })

      spawner.on('error', (err: Error) => {
        reject(new Error(`Maestro evaluation failed: ${err.message}`))
      })

      try {
        spawner.spawn({
          agentId: `maestro-${randomUUID().slice(0, 8)}`,
          sessionId: randomUUID(),
          message,
          systemPrompt,
          model: 'claude-haiku-4-5-20251001',
          permissionMode: 'plan',
          maxBudgetUsd: 0.05,
        })
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }
}

// ─── Prompt Construction ────────────────────────────────────────────────────

function buildMaestroSystemPrompt(context: MaestroContext): string {
  const agentList = context.agents
    .map((a, i) => `  ${i}. **${a.name}**: ${a.persona || 'General-purpose agent'}`)
    .join('\n')

  const historyBlock = context.executionHistory.length > 0
    ? context.executionHistory
        .map((e) => {
          const retryLabel = e.wasRetry ? ' (RETRY)' : ''
          const outputPreview = e.output.length > 800
            ? e.output.slice(0, 800) + '...'
            : e.output
          return `### Step ${e.stepIndex}${retryLabel}: ${e.agentName}\n${outputPreview}`
        })
        .join('\n\n')
    : '(No steps executed yet)'

  const memoriesBlock = context.memories.length > 0
    ? context.memories.map((m) => `- ${m}`).join('\n')
    : '(No learnings from previous runs)'

  return `You are the Maestro — an intelligent workflow orchestrator. Your job is to evaluate agent output and decide the next action.

IMPORTANT: Always respond in the SAME LANGUAGE as the workflow objective below. If the objective is in Portuguese, respond in Portuguese. If in English, respond in English. Match the user's language exactly.

## Your Responsibilities
1. Evaluate if the current step's output is sufficient and high quality
2. Contextualize instructions for the next agent so it understands what to do
3. Decide whether to continue, redirect (retry), or conclude the workflow early

## Workflow Objective
"${context.initialMessage}"

## Agents in this Workflow
${agentList}

## Execution History
${historyBlock}

## Learnings from Previous Runs
${memoriesBlock}

## Critical Rules

### About the "message" field
- The "message" field is passed DIRECTLY as the sole input to the next agent.
- The next agent will ONLY see this message — it has NO other context.
- You MUST include the relevant output/work from the current step inside the message.
- Format: Start with brief context and instructions, then include the FULL output from the previous step.
- Example for continue: "The Code Writer produced the following code. Review it for security issues and error handling:\n\n[full code output from previous step]"
- Example for redirect: "Your previous output was missing error handling. Please redo the task with proper try-catch blocks. Original request:\n\n[original objective]"
- NEVER send a message that is just instructions without the actual work output — the next agent needs the data to work with.

### Criticism level: ${context.rigor ?? 3}/5
${buildRigorInstructions(context.rigor ?? 3)}

### Decision logic
- If output is good enough, use action "continue" and pass a contextualized message WITH the output to the next agent
- If output is missing something critical, use action "redirect" to retry the same step with better instructions
- If the workflow objective has been fully achieved before all steps run, use action "conclude"
- Always explain your reasoning so the user understands your decision
- If you notice a recurring pattern (e.g., an agent always forgets something), record it as a learning

### About truncated outputs
- Agent outputs may be cut off due to token limits — this is NORMAL behavior, NOT an error
- If an output appears truncated (ends mid-sentence, has "[... truncated ...]"), do NOT redirect
- Treat truncated output as complete work — the agent did its best within its token budget
- Pass the truncated output as-is to the next agent — it can still work with partial results
- Only redirect if the output is fundamentally wrong or missing critical parts, NOT because it was cut short

${context.customInstructions ? `## Custom Instructions from User\n${context.customInstructions}\n` : ''}## Response Format
You MUST respond with ONLY a JSON object (no markdown, no code fences):
{
  "action": "continue" | "redirect" | "conclude",
  "targetStepIndex": <number — next step index for continue, same step for redirect>,
  "message": "<contextualized message for the next/retried agent>",
  "reasoning": "<explanation of your decision for the user>",
  "learning": "<pattern observed, or null if none>"
}`
}

function buildRigorInstructions(rigor: number): string {
  switch (rigor) {
    case 1:
      return 'You are in RELAXED mode. Almost always continue. Only redirect for critical errors that would make the output unusable. Accept partial or imperfect work.'
    case 2:
      return 'You are in LENIENT mode. Accept most outputs. Only redirect when something clearly important is missing. Be forgiving of minor issues.'
    case 3:
      return 'You are in BALANCED mode (default). Evaluate fairly. Suggest redirects when meaningful improvements are needed, but not for minor issues. Prefer continuing over redirecting.'
    case 4:
      return 'You are in STRICT mode. Hold agents to higher standards. Redirect when output is incomplete, lacks important details, or misses key requirements. Still prefer continue for minor issues.'
    case 5:
      return 'You are in DEMANDING mode. Expect comprehensive, production-ready output. Redirect for any significant gap in quality, completeness, or correctness. Only continue when output fully meets expectations.'
    default:
      return 'You are in BALANCED mode (default). Evaluate fairly and prefer continuing over redirecting.'
  }
}

function buildMaestroUserMessage(context: MaestroContext): string {
  const outputPreview = context.currentStepOutput.length > 6000
    ? context.currentStepOutput.slice(0, 6000) + '\n\n[... output truncated for context window ...]'
    : context.currentStepOutput

  const currentAgent = context.agents[context.completedStepIndex]
  const nextStepIndex = context.completedStepIndex + 1
  const isLastStep = nextStepIndex >= context.totalSteps
  const nextAgent = !isLastStep ? context.agents[nextStepIndex] : null

  return `Step ${context.completedStepIndex} (${currentAgent?.name ?? 'unknown'}) just completed.

## Output
${outputPreview}

## Status
- Completed step: ${context.completedStepIndex} of ${context.totalSteps - 1} (0-indexed)
- ${isLastStep ? 'This was the LAST step. Decide: conclude with summary, or redirect if needed.' : `Next step would be: ${nextStepIndex} (${nextAgent?.name ?? 'unknown'})`}

Evaluate the output and decide what to do next.
IMPORTANT: Your "message" field must include the full output above — the next agent receives ONLY your message as input.
Respond with JSON only.`
}

// ─── Response Parsing ───────────────────────────────────────────────────────

function parseMaestroResponse(raw: string, context: MaestroContext): MaestroDecision {
  // Try to extract JSON from the response (handle code fences, extra text)
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return fallbackDecision(context)
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>

    const action = validateAction(parsed.action)
    const targetStepIndex = typeof parsed.targetStepIndex === 'number'
      ? parsed.targetStepIndex
      : action === 'redirect'
        ? context.completedStepIndex
        : context.completedStepIndex + 1
    const message = typeof parsed.message === 'string' ? parsed.message : ''
    const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : 'No reasoning provided.'
    const learning = typeof parsed.learning === 'string' ? parsed.learning : null

    return { action, targetStepIndex, message, reasoning, learning }
  } catch {
    return fallbackDecision(context)
  }
}

function validateAction(value: unknown): MaestroAction {
  if (value === 'continue' || value === 'redirect' || value === 'conclude') {
    return value
  }
  return 'continue'
}

function fallbackDecision(context: MaestroContext): MaestroDecision {
  const nextStep = context.completedStepIndex + 1
  const isLast = nextStep >= context.totalSteps

  return {
    action: isLast ? 'conclude' : 'continue',
    targetStepIndex: nextStep,
    message: isLast
      ? 'Workflow completed.'
      : context.currentStepOutput,
    reasoning: 'Maestro could not parse the evaluation response. Proceeding with default behavior.',
    learning: null,
  }
}
