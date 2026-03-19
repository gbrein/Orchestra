'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TokenUsage } from '@orchestra/shared'
import { getSocket, isSocketCreated } from '@/lib/socket'

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
  }

  return {
    type,
    message: rawMessage,
    userMessage: USER_MESSAGES[type] ?? 'An unexpected error occurred. Please try again.',
    retryable,
  }
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useAgentStream(agentId: string | null): UseAgentStreamReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState<boolean>(false)
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null)
  const [error, setError] = useState<AgentChatError | null>(null)

  // Track the current streaming message id to avoid stale closures
  const streamingMessageIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!agentId || !isSocketCreated()) return

    function handleText(data: {
      agentId: string
      sessionId: string
      content: string
      partial: boolean
    }) {
      if (data.agentId !== agentId) return

      if (data.partial) {
        // Streaming: append to or create the current assistant message
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'assistant' && last.partial) {
            // Update the existing partial message immutably
            return [
              ...prev.slice(0, prev.length - 1),
              { ...last, content: last.content + data.content },
            ]
          }
          // Start a new partial message
          const newId = crypto.randomUUID()
          streamingMessageIdRef.current = newId
          return [
            ...prev,
            {
              id: newId,
              role: 'assistant',
              content: data.content,
              timestamp: new Date(),
              partial: true,
            },
          ]
        })
        setIsStreaming(true)
      } else {
        // Final chunk: finalize the partial message or create a complete one
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'assistant' && last.partial) {
            return [
              ...prev.slice(0, prev.length - 1),
              {
                ...last,
                content: last.content + (data.content ?? ''),
                partial: false,
              },
            ]
          }
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
        })
        streamingMessageIdRef.current = null
      }
    }

    function handleToolUse(data: {
      agentId: string
      sessionId: string
      toolName: string
      input: unknown
    }) {
      if (data.agentId !== agentId) return

      const toolMessageId = crypto.randomUUID()
      setMessages((prev) => [
        ...prev,
        {
          id: toolMessageId,
          role: 'tool',
          content: '',
          toolUse: { toolName: data.toolName, input: data.input },
          timestamp: new Date(),
        },
      ])
    }

    function handleToolResult(data: {
      agentId: string
      sessionId: string
      toolName: string
      output: unknown
    }) {
      if (data.agentId !== agentId) return

      // Update the most recent tool message matching this tool name
      setMessages((prev) => {
        const lastToolIdx = [...prev]
          .reverse()
          .findIndex((m) => m.role === 'tool' && m.toolUse?.toolName === data.toolName)

        if (lastToolIdx === -1) return prev

        const realIdx = prev.length - 1 - lastToolIdx
        const updated: ChatMessage = {
          ...prev[realIdx],
          toolUse: {
            ...prev[realIdx].toolUse!,
            output: data.output,
          },
        }

        return [
          ...prev.slice(0, realIdx),
          updated,
          ...prev.slice(realIdx + 1),
        ]
      })
    }

    function handleError(data: {
      agentId: string
      sessionId: string
      error: string
      type: string
    }) {
      if (data.agentId !== agentId) return

      setIsStreaming(false)
      streamingMessageIdRef.current = null
      setError(classifyError(data.type, data.error))
    }

    function handleDone(data: {
      agentId: string
      sessionId: string
      usage: TokenUsage
    }) {
      if (data.agentId !== agentId) return

      setIsStreaming(false)
      streamingMessageIdRef.current = null
      setTokenUsage(data.usage)

      // Finalize any dangling partial message
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.partial) {
          return [...prev.slice(0, prev.length - 1), { ...last, partial: false }]
        }
        return prev
      })
    }

    const socket = getSocket()
    socket.on('agent:text', handleText)
    socket.on('agent:tool_use', handleToolUse)
    socket.on('agent:tool_result', handleToolResult)
    socket.on('agent:error', handleError)
    socket.on('agent:done', handleDone)

    return () => {
      const s = getSocket()
      s.off('agent:text', handleText)
      s.off('agent:tool_use', handleToolUse)
      s.off('agent:tool_result', handleToolResult)
      s.off('agent:error', handleError)
      s.off('agent:done', handleDone)
    }
  }, [agentId])

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
      if (!sock.connected) sock.connect()
      if (isStreaming) {
        sock.emit('agent:message', { agentId, message: trimmed })
      } else {
        setIsStreaming(true)
        sock.emit('agent:start', { agentId, message: trimmed })
      }
    },
    [agentId, isStreaming],
  )

  const stopAgent = useCallback(() => {
    if (!agentId) return
    getSocket().emit('agent:stop', { agentId })
    setIsStreaming(false)
    streamingMessageIdRef.current = null
    // Finalize any partial message
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      if (last?.partial) {
        return [...prev.slice(0, prev.length - 1), { ...last, partial: false }]
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
