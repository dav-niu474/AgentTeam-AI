/**
 * Event emitter utility for the Next.js API routes to broadcast
 * real-time events through the WebSocket service.
 *
 * Server-to-server: uses direct localhost call (no gateway needed).
 */

const WS_SERVICE_URL = 'http://localhost:3002/api/broadcast'

export async function broadcastEvent(event: string, data: unknown): Promise<void> {
  try {
    await fetch(WS_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data }),
    })
  } catch (error) {
    // Non-blocking: don't fail the API request if broadcast fails
    console.error(`[events] Failed to broadcast "${event}":`, error)
  }
}
