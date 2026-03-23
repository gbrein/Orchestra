// Workflow Generator — types for AI-generated multi-agent workflows.

import type { AgentPurpose, ModelTier } from './models'

export interface GeneratedAgent {
  readonly tempId: string
  readonly name: string
  readonly description: string
  readonly persona: string
  readonly purpose: AgentPurpose
  readonly model: ModelTier
  readonly suggestedSkills: readonly string[]
}

export interface GeneratedEdge {
  readonly from: string
  readonly to: string
  readonly condition?: string
}

export interface GeneratedWorkflow {
  readonly name: string
  readonly agents: readonly GeneratedAgent[]
  readonly edges: readonly GeneratedEdge[]
  readonly maestroEnabled: boolean
}

export interface GeneratedAgentWithPosition extends GeneratedAgent {
  readonly position: { readonly x: number; readonly y: number }
}

export interface GeneratedWorkflowWithLayout extends Omit<GeneratedWorkflow, 'agents'> {
  readonly agents: readonly GeneratedAgentWithPosition[]
}
