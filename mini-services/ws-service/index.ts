import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Server, Socket } from 'socket.io'

// Supported event types for validation
const VALID_EVENTS = new Set([
  'issue:created',
  'issue:status',
  'issue:assigned',
  'comment:added',
  'agent:status',
  'inspiration:update',
  'session:update',
  'daemon:heartbeat',
  'notification',
])

// Track connected clients
let connectedClients = 0

// HTTP request handler for our API routes
function handleHttpRequest(req: IncomingMessage, res: ServerResponse): boolean {
  // Handle POST /api/broadcast - for Next.js server to push events
  if (req.method === 'POST' && req.url === '/api/broadcast') {
    let body = ''

    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
    })

    req.on('end', () => {
      try {
        const { event, data } = JSON.parse(body)

        if (!event || typeof event !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Event name is required' }))
          return
        }

        if (!VALID_EVENTS.has(event)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: `Unknown event: ${event}. Valid events: ${Array.from(VALID_EVENTS).join(', ')}` }))
          return
        }

        // Broadcast to all connected clients
        io.emit(event, data)
        console.log(`[ws] Broadcast "${event}" to ${connectedClients} clients`)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true, event, clients: connectedClients }))
      } catch (parseError) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid JSON body' }))
      }
    })
    return true // Request handled
  }

  // Handle GET /api/health - health check endpoint
  if (req.method === 'GET' && req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      clients: connectedClients,
      uptime: process.uptime(),
    }))
    return true // Request handled
  }

  return false // Not our route, let socket.io handle it
}

// Create HTTP server with our request handler
const httpServer = createServer((req, res) => {
  // If our handler takes care of it, we're done
  if (handleHttpRequest(req, res)) {
    return
  }
  // Otherwise, respond with 404 (socket.io handles its own requests via upgrade)
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

// Attach socket.io to the HTTP server
// Using default path '/socket.io/' so our HTTP API routes don't conflict
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

io.on('connection', (socket: Socket) => {
  connectedClients++
  console.log(`[ws] Client connected: ${socket.id} (total: ${connectedClients})`)

  socket.on('disconnect', (reason) => {
    connectedClients--
    console.log(`[ws] Client disconnected: ${socket.id} reason: ${reason} (total: ${connectedClients})`)
  })

  socket.on('error', (error: Error) => {
    console.error(`[ws] Socket error (${socket.id}):`, error.message)
  })
})

const PORT = 3002
httpServer.listen(PORT, () => {
  console.log(`[ws] AgentTeam WebSocket service running on port ${PORT}`)
  console.log(`[ws] Broadcast API: POST http://localhost:${PORT}/api/broadcast`)
  console.log(`[ws] Health check: GET http://localhost:${PORT}/api/health`)
  console.log(`[ws] Socket.io path: /socket.io/`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[ws] Received SIGTERM, shutting down...')
  io.close()
  httpServer.close(() => {
    console.log('[ws] Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('[ws] Received SIGINT, shutting down...')
  io.close()
  httpServer.close(() => {
    console.log('[ws] Server closed')
    process.exit(0)
  })
})
