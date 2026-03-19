'use client'

import { useEffect, useState } from 'react'
import { socket } from '@/lib/socket'

export interface UseSocketReturn {
  connected: boolean
  connecting: boolean
  error: string | null
}

export function useSocket(): UseSocketReturn {
  const [connected, setConnected] = useState<boolean>(socket.connected)
  const [connecting, setConnecting] = useState<boolean>(!socket.connected)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function handleConnect() {
      setConnected(true)
      setConnecting(false)
      setError(null)
    }

    function handleDisconnect() {
      setConnected(false)
      setConnecting(false)
    }

    function handleConnectError(err: Error) {
      setConnected(false)
      setConnecting(false)
      setError(err.message)
    }

    function handleReconnectAttempt() {
      setConnected(false)
      setConnecting(true)
      setError(null)
    }

    function handleReconnect() {
      setConnected(true)
      setConnecting(false)
      setError(null)
      // [G25] Re-sync missed state after reconnection
      socket.emit('agent:message', { agentId: '__sync__', message: 'sync' })
    }

    function handleReconnectFailed() {
      setConnecting(false)
      setError('Connection failed after maximum retries')
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)
    socket.io.on('reconnect_attempt', handleReconnectAttempt)
    socket.io.on('reconnect', handleReconnect)
    socket.io.on('reconnect_failed', handleReconnectFailed)

    if (!socket.connected) {
      setConnecting(true)
      socket.connect()
    }

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)
      socket.io.off('reconnect_attempt', handleReconnectAttempt)
      socket.io.off('reconnect', handleReconnect)
      socket.io.off('reconnect_failed', handleReconnectFailed)
      socket.disconnect()
    }
  }, [])

  return { connected, connecting, error }
}
