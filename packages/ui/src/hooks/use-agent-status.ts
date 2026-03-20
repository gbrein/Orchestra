'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Node } from '@xyflow/react'
import type { AgentStatus } from '@orchestra/shared'
import { getSocket } from '@/lib/socket'

interface UseAgentStatusReturn {
  sessionTokens: number
}

/**
 * Listens for agent:status and agent:done socket events at the page level.
 * - Updates node data status when agents start/stop
 * - Accumulates total session token usage for the bottom bar
 */
export function useAgentStatus(
  onNodeStatusChange: (agentId: string, status: AgentStatus) => void,
): UseAgentStatusReturn {
  const [sessionTokens, setSessionTokens] = useState(0)
  const attachedRef = useRef(false)
  const callbackRef = useRef(onNodeStatusChange)
  callbackRef.current = onNodeStatusChange

  useEffect(() => {
    if (attachedRef.current) return
    attachedRef.current = true

    const socket = getSocket()

    socket.on('agent:status', (data: { agentId: string; status: string }) => {
      callbackRef.current(data.agentId, data.status as AgentStatus)
    })

    socket.on('agent:done', (data: { agentId: string; sessionId: string; usage: { inputTokens: number; outputTokens: number } }) => {
      const total = (data.usage?.inputTokens ?? 0) + (data.usage?.outputTokens ?? 0)
      setSessionTokens((prev) => prev + total)
      callbackRef.current(data.agentId, 'idle')
    })
  }, [])

  return { sessionTokens }
}
