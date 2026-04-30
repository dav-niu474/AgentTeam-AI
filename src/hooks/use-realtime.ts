'use client'

import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Hook that connects to the WebSocket service and auto-invalidates
 * relevant TanStack Query caches when real-time events are received.
 */
export function useRealtime() {
  const queryClient = useQueryClient()
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    // Connect through gateway using XTransformPort pattern
    // The ws-service uses socket.io default path '/socket.io/'
    const socket: Socket = io('/?XTransformPort=3002', {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[realtime] Connected, id:', socket.id)
    })

    socket.on('disconnect', (reason) => {
      console.log('[realtime] Disconnected:', reason)
    })

    let errorCount = 0
    socket.on('connect_error', () => {
      errorCount++
      // Only log the first error, then silently retry
      if (errorCount === 1) {
        console.info('[realtime] WebSocket not available, real-time updates disabled. Retrying silently...')
      }
    })

    socket.on('connect', () => {
      if (errorCount > 0) {
        console.info('[realtime] Connected after', errorCount, 'retries')
      }
      errorCount = 0
    })

    // Map events to query keys that should be invalidated
    const eventHandlers: Record<string, string[]> = {
      'issue:created': ['issues', 'stats'],
      'issue:status': ['issues', 'stats'],
      'issue:assigned': ['issues'],
      'comment:added': ['comments', 'issues'],
      'agent:status': ['members', 'stats'],
      'inspiration:update': ['inspirations', 'stats'],
      'session:update': ['sessions'],
      'daemon:heartbeat': ['daemons'],
      'notification': ['stats'],
    }

    // Register handlers for each event type
    const cleanupFns: Array<() => void> = []

    Object.entries(eventHandlers).forEach(([event, queryKeys]) => {
      const handler = () => {
        queryKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [key] })
        })
      }
      socket.on(event, handler)
      cleanupFns.push(() => socket.off(event, handler))
    })

    return () => {
      cleanupFns.forEach((fn) => fn())
      socket.disconnect()
      socketRef.current = null
    }
  }, [queryClient])

  return socketRef
}
