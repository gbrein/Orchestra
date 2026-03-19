import type { MessageRole, TokenUsage } from './session'

// Client -> Server events
export interface ClientToServerEvents {
  'agent:start': (data: { agentId: string; message: string }) => void
  'agent:stop': (data: { agentId: string }) => void
  'agent:message': (data: { agentId: string; message: string }) => void
  'approval:respond': (data: { agentId: string; approved: boolean; editedCommand?: string }) => void
  'discussion:start': (data: { tableId: string }) => void
  'discussion:pause': (data: { tableId: string }) => void
  'discussion:resume': (data: { tableId: string }) => void
  'canvas:save': (data: { workspaceId: string; nodes: unknown[]; edges: unknown[]; viewport: unknown }) => void
}

// Server -> Client events
export interface ServerToClientEvents {
  'agent:status': (data: { agentId: string; status: string }) => void
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
