'use client'

import { useEffect, useState, useRef } from 'react'
import { getSocket } from '@/lib/socket'

export interface UseSocketReturn {
  connected: boolean
  connecting: boolean
  error: string | null
}

export function useSocket(): UseSocketReturn {
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    let socket: ReturnType<typeof getSocket> | null = null

    const handleConnect = () => {
      if (!mountedRef.current) return
      setConnected(true)
      setConnecting(false)
      setError(null)
    }

    const handleDisconnect = () => {
      if (!mountedRef.current) return
      setConnected(false)
      setConnecting(false)
    }

    const handleConnectError = () => {
      if (!mountedRef.current) return
      setConnected(false)
      setConnecting(false)
      // Don't spam error state when server isn't running
    }

    // Delay connection attempt so the UI renders first
    const timer = setTimeout(() => {
      if (!mountedRef.current) return
      try {
        socket = getSocket()
        socket.on('connect', handleConnect)
        socket.on('disconnect', handleDisconnect)
        socket.on('connect_error', handleConnectError)

        if (!socket.connected) {
          setConnecting(true)
          socket.connect()
        } else {
          setConnected(true)
        }
      } catch {
        setConnecting(false)
      }
    }, 500)

    return () => {
      mountedRef.current = false
      clearTimeout(timer)
      if (socket) {
        socket.off('connect', handleConnect)
        socket.off('disconnect', handleDisconnect)
        socket.off('connect_error', handleConnectError)
      }
    }
  }, [])

  return { connected, connecting, error }
}
