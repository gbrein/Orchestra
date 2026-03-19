import { io, Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@orchestra/shared'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3001'

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
})
