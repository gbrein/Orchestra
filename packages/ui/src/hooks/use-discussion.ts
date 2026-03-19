'use client'

import { useCallback, useEffect, useState } from 'react'
import { socket } from '@/lib/socket'
import type { DiscussionStatus } from '@orchestra/shared'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface DiscussionTurn {
  readonly id: string
  readonly agentName: string
  readonly role: string
  readonly content: string
  readonly timestamp: Date
  readonly type: 'participant' | 'moderator_decision' | 'conclusion'
}

export interface UseDiscussionReturn {
  readonly turns: readonly DiscussionTurn[]
  readonly status: DiscussionStatus
  readonly currentRound: number
  readonly conclusion: string | null
  readonly isRunning: boolean
  readonly start: () => void
  readonly pause: () => void
  readonly resume: () => void
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useDiscussion(tableId: string | null): UseDiscussionReturn {
  const [turns, setTurns] = useState<readonly DiscussionTurn[]>([])
  const [status, setStatus] = useState<DiscussionStatus>('draft')
  const [currentRound, setCurrentRound] = useState(0)
  const [conclusion, setConclusion] = useState<string | null>(null)

  // Reset state when tableId changes
  useEffect(() => {
    setTurns([])
    setStatus('draft')
    setCurrentRound(0)
    setConclusion(null)
  }, [tableId])

  useEffect(() => {
    if (!tableId) return

    function handleTurn(data: {
      tableId: string
      agentName: string
      role: string
      content: string
    }) {
      if (data.tableId !== tableId) return

      const turn: DiscussionTurn = {
        id: crypto.randomUUID(),
        agentName: data.agentName,
        role: data.role,
        content: data.content,
        timestamp: new Date(),
        type: 'participant',
      }

      setTurns((prev) => [...prev, turn])
      setStatus('active')
      // Increment round when the first participant speaks in a new round.
      // The server sends role='moderator' for moderator decisions; only
      // count participant turns to approximate round tracking client-side.
      if (data.role !== 'moderator') {
        setCurrentRound((prev) => prev + 1)
      }
    }

    function handleModerator(data: {
      tableId: string
      decision: string
      reasoning: string
    }) {
      if (data.tableId !== tableId) return

      const turn: DiscussionTurn = {
        id: crypto.randomUUID(),
        agentName: 'Moderator',
        role: 'moderator',
        content: `${data.decision}: ${data.reasoning}`,
        timestamp: new Date(),
        type: 'moderator_decision',
      }

      setTurns((prev) => [...prev, turn])
    }

    function handleConcluded(data: { tableId: string; conclusion: string }) {
      if (data.tableId !== tableId) return

      const turn: DiscussionTurn = {
        id: crypto.randomUUID(),
        agentName: 'Moderator',
        role: 'moderator',
        content: data.conclusion,
        timestamp: new Date(),
        type: 'conclusion',
      }

      setTurns((prev) => [...prev, turn])
      setConclusion(data.conclusion)
      setStatus('concluded')
    }

    socket.on('discussion:turn', handleTurn)
    socket.on('discussion:moderator', handleModerator)
    socket.on('discussion:concluded', handleConcluded)

    return () => {
      socket.off('discussion:turn', handleTurn)
      socket.off('discussion:moderator', handleModerator)
      socket.off('discussion:concluded', handleConcluded)
    }
  }, [tableId])

  const start = useCallback(() => {
    if (!tableId) return
    socket.emit('discussion:start', { tableId })
    setStatus('active')
  }, [tableId])

  const pause = useCallback(() => {
    if (!tableId) return
    socket.emit('discussion:pause', { tableId })
  }, [tableId])

  const resume = useCallback(() => {
    if (!tableId) return
    socket.emit('discussion:resume', { tableId })
  }, [tableId])

  const isRunning = status === 'active'

  return {
    turns,
    status,
    currentRound,
    conclusion,
    isRunning,
    start,
    pause,
    resume,
  }
}
