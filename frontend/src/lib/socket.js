import { io } from 'socket.io-client'

let socket = null

export function connectSocket(getToken) {
  if (socket && socket.connected) return socket

  const token = typeof getToken === 'function' ? getToken() : getToken
  // Prefer VITE_API_URL in production; fallback to current host:5001 in dev
  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
    ? import.meta.env.VITE_API_URL
    : null

  const hostname = window.location.hostname;
  const backendUrl = (hostname === 'localhost' || hostname === '127.0.0.1')
    ? 'http://localhost:5001'
    : (envUrl || `${window.location.protocol}//${hostname}:5001`);

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


