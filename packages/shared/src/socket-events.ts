import type { TokenUsage } from './session'
import type { AgentMode } from './agent'

// Minimal chain definition used for socket-level communication
export interface ChainStepPayload {
  readonly agentId: string
  readonly config?: Record<string, unknown>
  readonly conditions?: ReadonlyArray<{ pattern: string; targetStepIndex: number }>
}

export interface ChainEdgePayload {
  readonly from: number
  readonly to: number
  readonly condition?: string
}

export interface ChainDefinition {
  readonly steps: readonly ChainStepPayload[]
  readonly edges: readonly ChainEdgePayload[]
}

// Client -> Server events
export interface ClientToServerEvents {
  'agent:start': (data: { agentId: string; message: string; workspaceId?: string }) => void
  'agent:stop': (data: { agentId: string }) => void
  'agent:message': (data: { agentId: string; message: string }) => void
  'approval:respond': (data: { agentId: string; approved: boolean; editedCommand?: string }) => void
  'discussion:start': (data: { tableId: string }) => void
  'discussion:pause': (data: { tableId: string }) => void
  'discussion:resume': (data: { tableId: string }) => void
  'canvas:save': (data: { workspaceId: string; nodes: unknown[]; edges: unknown[]; viewport: unknown }) => void
  'loop:start': (data: { agentId: string; message: string }) => void
  'loop:stop': (data: { agentId: string }) => void
  'loop:approve': (data: { agentId: string; loopId: string; approved: boolean }) => void
  'agent:set_mode': (data: { agentId: string; mode: AgentMode }) => void
  'chain:execute': (data: { chainId?: string; definition: ChainDefinition; initialMessage: string; workspaceId?: string; maestro?: boolean }) => void
  'chain:stop': (data: { chainId: string }) => void
  'chain:maestro_redirect_response': (data: { chainId: string; requestId: string; approved: boolean }) => void
  'advisor:analyze': (data: { chainId: string; model?: string }) => void
}

// Server -> Client events
export interface ServerToClientEvents {
  'agent:status': (data: { agentId: string; status: string }) => void
  'agent:mode_changed': (data: { agentId: string; mode: AgentMode }) => void
  'agent:text': (data: { agentId: string; sessionId: string; content: string; partial: boolean }) => void
  'agent:tool_use': (data: { agentId: string; sessionId: string; toolName: string; input: unknown }) => void
  'agent:tool_result': (data: { agentId: string; sessionId: string; toolName: string; output: unknown }) => void
  'agent:approval': (data: { agentId: string; sessionId: string; command: string; description: string }) => void
  'agent:error': (data: { agentId: string; sessionId: string; error: string; type: string }) => void
  'agent:done': (data: { agentId: string; sessionId: string; usage: TokenUsage }) => void
  'agent:loop_iteration': (data: { agentId: string; iteration: number; maxIterations: number }) => void
  'discussion:turn': (data: { tableId: string; agentName: string; role: string; content: string }) => void
  'discussion:moderator': (data: { tableId: string; decision: string; reasoning: string }) => void
  'discussion:concluded': (data: { tableId: string; conclusion: string }) => void
  'chain:step_start': (data: { chainId: string; stepIndex: number; agentId: string; cwd?: string }) => void
  'chain:step_text': (data: { chainId: string; stepIndex: number; agentId: string; content: string; partial: boolean }) => void
  'chain:step_tool_use': (data: { chainId: string; stepIndex: number; agentId: string; toolName: string; input: unknown; id: string }) => void
  'chain:step_tool_result': (data: { chainId: string; stepIndex: number; agentId: string; toolName: string; output: unknown; toolUseId: string }) => void
  'chain:step_usage': (data: { chainId: string; stepIndex: number; agentId: string; usage: TokenUsage }) => void
  'chain:step_complete': (data: { chainId: string; stepIndex: number; agentId: string; output: string }) => void
  'chain:complete': (data: { chainId: string; totalSteps: number }) => void
  'chain:error': (data: { chainId: string; stepIndex: number; error: string }) => void
  'chain:maestro_decision': (data: { chainId: string; reasoning: string; action: 'continue' | 'redirect' | 'conclude'; targetAgentName: string; message: string }) => void
  'chain:maestro_redirect_request': (data: { chainId: string; reasoning: string; fromAgent: string; toAgent: string; requestId: string }) => void
  'advisor:analyzing': (data: { chainId: string }) => void
  'advisor:result': (data: { chainId: string; result: { overallAssessment: string; objectiveMet: boolean; suggestions: Array<{ id: string; category: string; title: string; description: string; actionType?: string | null; actionPayload?: { agentId?: string; agentName?: string; skillName?: string; newPersona?: string }; severity: string }> } }) => void
  'advisor:error': (data: { chainId: string; error: string }) => void
  'notification': (data: { id: string; level: 'info' | 'action_required' | 'critical' | 'error'; title: string; agentId?: string; actions?: string[] }) => void
  'canvas:updated': (data: { workspaceId: string }) => void
}

export interface ApiResponse<T> {
  readonly success: boolean
  readonly data?: T
  readonly error?: string
  readonly meta?: {
    readonly total: number
    readonly page: number
    readonly limit: number
  }
}
