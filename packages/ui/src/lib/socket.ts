import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@orchestra/shared'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3001'

let _socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!_socket) {
    _socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 5000,
    })
  }
  return _socket
}

// Backward compat — lazy singleton
export const socket = new Proxy({} as Socket<ServerToClientEvents, ClientToServerEvents>, {
  get(_target, prop) {
    const s = getSocket()
    const value = (s as any)[prop]
    return typeof value === 'function' ? value.bind(s) : value
  },
})
