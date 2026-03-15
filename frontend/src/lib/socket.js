import { io } from 'socket.io-client'

let socket = null

export function connectSocket(getToken) {
  if (socket && socket.connected) return socket

  const token = typeof getToken === 'function' ? getToken() : getToken
  // In production: use VITE_API_URL (Render backend URL)
  // In development: use localhost:5001
  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
    : null

  const backendUrl = envUrl || 'http://localhost:5001';

  socket = io(backendUrl, {
    transports: ['websocket'],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000
  })

  return socket
}

export function getSocket() {
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}


