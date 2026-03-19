import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@orchestra/shared'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3001'

type OrchestraSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let _socket: OrchestraSocket | null = null
let _created = false

/**
 * Returns the socket singleton, creating it lazily on first call.
 * The socket is created with `autoConnect: false` — it will NOT
 * connect until `.connect()` is explicitly called.
 */
export function getSocket(): OrchestraSocket {
  if (!_socket) {
    _socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 3000,
      reconnectionDelayMax: 10000,
      timeout: 5000,
    })
    _created = true
  }
  return _socket
}

/**
 * Returns the socket ONLY if it was already created AND is connected.
 * Returns null otherwise. Use this in hooks that want to attach listeners
 * without triggering socket creation or connection.
 */
export function getSocketIfConnected(): OrchestraSocket | null {
  if (_socket && _socket.connected) return _socket
  return null
}

/**
 * Returns true if the socket has been created (even if not connected).
 */
export function isSocketCreated(): boolean {
  return _created
}
