'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getSocket } from '@/lib/socket'

export interface UseSocketReturn {
  connected: boolean
  connecting: boolean
  error: string | null
  connect: () => void
}

/**
 * Socket connection hook.
 * Does NOT auto-connect — call `connect()` explicitly when the user
 * triggers an action that requires the backend (e.g. starting an agent).
 * This avoids CORS error spam when only the UI is running.
 */
export function useSocket(): UseSocketReturn {
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const listenersAttachedRef = useRef(false)

  const attachListeners = useCallback(() => {
    if (listenersAttachedRef.current) return
    listenersAttachedRef.current = true

    const socket = getSocket()

    socket.on('connect', () => {
      if (!mountedRef.current) return
      setConnected(true)
      setConnecting(false)
      setError(null)
    })

    socket.on('disconnect', () => {
      if (!mountedRef.current) return
      setConnected(false)
      setConnecting(false)
    })

    socket.on('connect_error', () => {
      if (!mountedRef.current) return
      setConnected(false)
      setConnecting(false)
      setError('Cannot reach server')
    })
  }, [])

  const connect = useCallback(() => {
    const socket = getSocket()
    if (socket.connected) {
      setConnected(true)
      return
    }
    attachListeners()
    setConnecting(true)
    setError(null)
    socket.connect()
  }, [attachListeners])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  return { connected, connecting, error, connect }
}
