'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Node } from '@xyflow/react'
import type { AgentStatus } from '@orchestra/shared'
import { getSocket } from '@/lib/socket'

interface UseAgentStatusReturn {
  sessionTokens: number
  activeAgentIds: ReadonlySet<string>
}

/**
 * Listens for agent:status and agent:done socket events at the page level.
 * - Updates node data status when agents start/stop
 * - Accumulates total session token usage for the bottom bar
 * - Tracks which agents are currently active (for edge animation)
 */
export function useAgentStatus(
  onNodeStatusChange: (agentId: string, status: AgentStatus) => void,
): UseAgentStatusReturn {
  const [sessionTokens, setSessionTokens] = useState(0)
  const [activeAgentIds, setActiveAgentIds] = useState<ReadonlySet<string>>(new Set())
  const attachedRef = useRef(false)
  const callbackRef = useRef(onNodeStatusChange)
  const deactivateTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  callbackRef.current = onNodeStatusChange

  useEffect(() => {
    if (attachedRef.current) return
    attachedRef.current = true

    const socket = getSocket()

    socket.on('agent:status', (data: { agentId: string; status: string }) => {
      callbackRef.current(data.agentId, data.status as AgentStatus)

      if (data.status === 'running') {
        // Clear any pending deactivation timer
        const timer = deactivateTimers.current.get(data.agentId)
        if (timer) {
          clearTimeout(timer)
          deactivateTimers.current.delete(data.agentId)
        }
        setActiveAgentIds((prev) => {
          const next = new Set(prev)
          next.add(data.agentId)
          return next
        })
      }
    })

    socket.on('agent:done', (data: { agentId: string; sessionId: string; usage: { inputTokens: number; outputTokens: number } }) => {
      const total = (data.usage?.inputTokens ?? 0) + (data.usage?.outputTokens ?? 0)
      setSessionTokens((prev) => prev + total)
      callbackRef.current(data.agentId, 'idle')

      // Deactivate after a delay for visual trail effect
      const timer = setTimeout(() => {
        setActiveAgentIds((prev) => {
          const next = new Set(prev)
          next.delete(data.agentId)
          return next
        })
        deactivateTimers.current.delete(data.agentId)
      }, 1500)
      deactivateTimers.current.set(data.agentId, timer)
    })
  }, [])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of deactivateTimers.current.values()) {
        clearTimeout(timer)
      }
    }
  }, [])

  return { sessionTokens, activeAgentIds }
}
