'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TokenUsage } from '@orchestra/shared'
import { getSocket } from '@/lib/socket'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
  readonly id: string
  readonly role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  readonly toolUse?: {
    readonly toolName: string
    readonly input: unknown
    output?: unknown
  }
  readonly timestamp: Date
  partial?: boolean
}

export interface AgentChatError {
  readonly type: string
  readonly message: string
  readonly userMessage: string
  readonly retryable: boolean
}

export interface UseAgentStreamReturn {
  messages: ChatMessage[]
  isStreaming: boolean
  tokenUsage: TokenUsage | null
  error: AgentChatError | null
  sendMessage: (message: string) => void
  stopAgent: () => void
  clearMessages: () => void
}

// ─── Error classification ──────────────────────────────────────────────────

function classifyError(type: string, rawMessage: string): AgentChatError {
  const retryableTypes = new Set(['timeout', 'rate_limit', 'network', 'overloaded'])
  const retryable = retryableTypes.has(type)

  const USER_MESSAGES: Record<string, string> = {
    timeout: 'The request timed out. Please try again.',
    rate_limit: 'Too many requests. Please wait a moment before trying again.',
    network: 'A network error occurred. Check your connection and retry.',
    overloaded: 'The service is temporarily overloaded. Please try again shortly.',
    auth: 'Authentication failed. Please check your API configuration.',
    context_length: 'The conversation is too long. Consider clearing the chat.',
    PROCESS_ERROR: 'The assistant process failed to start. Make sure Claude Code is installed and configured.',
    APPROVAL_TIMEOUT: 'The approval request timed out.',
  }

  return {
    type,
    message: rawMessage,
    userMessage: USER_MESSAGES[type] ?? (rawMessage || 'An unexpected error occurred. Please try again.'),
    retryable,
  }
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useAgentStream(
  agentId: string | null,
  workspaceId?: string | null,
): UseAgentStreamReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState<boolean>(false)
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null)
  const [error, setError] = useState<AgentChatError | null>(null)

  const streamingMessageIdRef = useRef<string | null>(null)
  const listenersAttachedRef = useRef(false)
  const agentIdRef = useRef(agentId)
  const workspaceIdRef = useRef(workspaceId)

  // Keep refs in sync
  useEffect(() => {
    agentIdRef.current = agentId
    // Reset listeners when agent changes so they reattach for the new agent
    listenersAttachedRef.current = false
  }, [agentId])

  useEffect(() => {
    workspaceIdRef.current = workspaceId
  }, [workspaceId])

  // Attach socket listeners — called once when first message is sent
  const ensureListeners = useCallback(() => {
    if (listenersAttachedRef.current) return
    listenersAttachedRef.current = true

    const socket = getSocket()

    socket.on('agent:text', (data) => {
      if (data.agentId !== agentIdRef.current) return

      if (data.partial) {
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'assistant' && last.partial) {
            return [
              ...prev.slice(0, -1),
              { ...last, content: last.content + data.content },
            ]
          }
          return [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: data.content,
              timestamp: new Date(),
              partial: true,
            },
          ]
        })
        setIsStreaming(true)
      } else {
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'assistant' && last.partial) {
            return [
              ...prev.slice(0, -1),
              { ...last, content: data.content || last.content, partial: false },
            ]
          }
          if (data.content) {
            return [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: data.content,
                timestamp: new Date(),
                partial: false,
              },
            ]
          }
          return prev
        })
      }
    })

    socket.on('agent:tool_use', (data) => {
      if (data.agentId !== agentIdRef.current) return
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'tool',
          content: '',
          toolUse: { toolName: data.toolName, input: data.input },
          timestamp: new Date(),
        },
      ])
    })

    socket.on('agent:tool_result', (data) => {
      if (data.agentId !== agentIdRef.current) return
      setMessages((prev) => {
        const idx = [...prev].reverse().findIndex(
          (m) => m.role === 'tool' && m.toolUse?.toolName === data.toolName,
        )
        if (idx === -1) return prev
        const realIdx = prev.length - 1 - idx
        return [
          ...prev.slice(0, realIdx),
          { ...prev[realIdx], toolUse: { ...prev[realIdx].toolUse!, output: data.output } },
          ...prev.slice(realIdx + 1),
        ]
      })
    })

    socket.on('agent:error', (data) => {
      if (data.agentId !== agentIdRef.current) return
      setIsStreaming(false)
      streamingMessageIdRef.current = null
      setError(classifyError(data.type, data.error))
    })

    socket.on('agent:done', (data) => {
      if (data.agentId !== agentIdRef.current) return
      setIsStreaming(false)
      streamingMessageIdRef.current = null
      setTokenUsage(data.usage)
      // Finalize any dangling partial message
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.partial) {
          return [...prev.slice(0, -1), { ...last, partial: false }]
        }
        return prev
      })
    })
  }, [])

  const sendMessage = useCallback(
    (message: string) => {
      if (!agentId || !message.trim()) return

      const trimmed = message.trim()

      setError(null)
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: trimmed,
          timestamp: new Date(),
        },
      ])

      const sock = getSocket()

      // Ensure listeners are attached BEFORE sending
      ensureListeners()

      if (!sock.connected) {
        sock.connect()

        const connectTimeout = setTimeout(() => {
          if (!sock.connected) {
            setIsStreaming(false)
            setError({
              type: 'network',
              message: 'Cannot reach the Orchestra server',
              userMessage: 'Cannot reach the server. Make sure the backend is running: npm run dev:server',
              retryable: true,
            })
          }
        }, 5000)

        sock.once('connect', () => {
          clearTimeout(connectTimeout)
          setIsStreaming(true)
          sock.emit('agent:start', {
            agentId,
            message: trimmed,
            workspaceId: workspaceIdRef.current ?? undefined,
          })
        })
        return
      }

      if (isStreaming) {
        sock.emit('agent:message', { agentId, message: trimmed })
      } else {
        setIsStreaming(true)
        sock.emit('agent:start', {
          agentId,
          message: trimmed,
          workspaceId: workspaceIdRef.current ?? undefined,
        })
      }
    },
    [agentId, isStreaming, ensureListeners],
  )

  const stopAgent = useCallback(() => {
    if (!agentId) return
    getSocket().emit('agent:stop', { agentId })
    setIsStreaming(false)
    streamingMessageIdRef.current = null
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      if (last?.partial) {
        return [...prev.slice(0, -1), { ...last, partial: false }]
      }
      return prev
    })
  }, [agentId])

  const clearMessages = useCallback(() => {
    setMessages([])
    setTokenUsage(null)
    setError(null)
    setIsStreaming(false)
    streamingMessageIdRef.current = null
  }, [])

  return { messages, isStreaming, tokenUsage, error, sendMessage, stopAgent, clearMessages }
}
