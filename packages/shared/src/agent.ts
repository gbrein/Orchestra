import type { ModelTier, AgentPurpose } from './models'

export type AgentStatus = 'idle' | 'running' | 'waiting_approval' | 'error'

export interface Agent {
  readonly id: string
  readonly name: string
  readonly avatar: string | null
  readonly description: string | null
  readonly persona: string
  readonly purpose: AgentPurpose | null
  readonly scope: readonly string[]
  readonly allowedTools: readonly string[]
  readonly memoryEnabled: boolean
  readonly model: ModelTier | null
  readonly status: AgentStatus
  readonly loopEnabled: boolean
  readonly loopCriteria: LoopCriteria | null
  readonly maxIterations: number
  readonly teamEnabled: boolean
  readonly canvasX: number
  readonly canvasY: number
  readonly createdAt: string
  readonly updatedAt: string
}

export interface LoopCriteria {
  readonly type: 'regex' | 'test_pass' | 'manual' | 'max_iterations'
  readonly value: string
}

export interface CreateAgentInput {
  readonly name: string
  readonly persona: string
  readonly description?: string
  readonly avatar?: string
  readonly purpose?: AgentPurpose
  readonly scope?: readonly string[]
  readonly allowedTools?: readonly string[]
  readonly memoryEnabled?: boolean
  readonly model?: ModelTier
}

export interface UpdateAgentInput extends Partial<CreateAgentInput> {
  readonly status?: AgentStatus
  readonly canvasX?: number
  readonly canvasY?: number
  readonly loopEnabled?: boolean
  readonly loopCriteria?: LoopCriteria
  readonly maxIterations?: number
  readonly teamEnabled?: boolean
}
