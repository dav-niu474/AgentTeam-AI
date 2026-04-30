/**
 * AgentTeam Daemon Service
 * Standalone Bun service that runs on the user's terminal to execute Agent tasks.
 * Port: 3003
 */

import { createServer, IncomingMessage, ServerResponse } from 'http'
import { detectTools, getAvailableToolNames, type DetectedTool } from './lib/cli-detector'
import { executeAgentTask, type AgentConfig, type TaskResult } from './lib/agent-executor'
import { createWorkspace, listWorkspaces, workspaceExists, cleanupWorkspace } from './lib/workspace-manager'

// ==========================================
// Types
// ==========================================

interface Task {
  id: string
  issueId: string
  agentId: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'aborted'
  workspaceDir: string
  scene?: string
  startedAt?: string
  completedAt?: string
  result?: string
  error?: string
}

// ==========================================
// State
// ==========================================

const PORT = 3003
const MAIN_PLATFORM_URL = 'http://localhost:3000'
const MAX_CONCURRENT_TASKS = 2

let daemonId: string | null = null
let detectedTools: DetectedTool[] = []
let tasks: Map<string, Task> = new Map()
let runningCount = 0
let heartbeatInterval: ReturnType<typeof setInterval> | null = null

// ==========================================
// Helpers
// ==========================================

function generateId(): string {
  return `daemon-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
}

async function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => {
      try { resolve(JSON.parse(body)) } catch { resolve({}) }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, data: any, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

/** Call the main platform's API (server-to-server, no XTransformPort needed) */
async function callPlatform(method: string, path: string, body?: any): Promise<any> {
  try {
    const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
    if (body) opts.body = JSON.stringify(body)
    const res = await fetch(`${MAIN_PLATFORM_URL}${path}`, opts)
    if (!res.ok) {
      const text = await res.text()
      console.error(`[daemon] Platform call failed: ${method} ${path} → ${res.status}: ${text}`)
      return null
    }
    return await res.json()
  } catch (error) {
    console.error(`[daemon] Platform call error: ${method} ${path}`, error)
    return null
  }
}

/** Add a comment to an issue on the main platform */
async function addComment(issueId: string, content: string, agentId: string) {
  await callPlatform('POST', '/api/comments', {
    content,
    issueId,
    authorId: agentId,
    authorType: 'agent',
  })
}

/** Update issue status on the main platform */
async function updateIssueStatus(issueId: string, status: string) {
  await callPlatform('PATCH', `/api/issues/${issueId}/status`, { status })
}

// ==========================================
// Task Execution
// ==========================================

async function runTask(task: Task, agentConfig: AgentConfig) {
  task.status = 'running'
  task.startedAt = new Date().toISOString()
  runningCount++

  try {
    // Create workspace
    const workspace = await createWorkspace(task.issueId, task.description)
    task.workspaceDir = workspace.dir

    // Post "started" comment
    await addComment(task.issueId, `🚀 开始执行任务...\n\n**工作目录**: \`${workspace.dir}\`\n**场景**: ${task.scene || 'custom'}`, task.agentId)

    // Execute agent task with 3-phase pipeline
    const result: TaskResult = await executeAgentTask(
      task.description,
      agentConfig,
      workspace.dir,
      async (phase: string, message: string) => {
        // Progress callback - post updates as comments
        console.log(`[daemon] Task ${task.id} phase: ${phase} - ${message}`)
        if (phase === 'planning') {
          await addComment(task.issueId, `📋 ${message}`, task.agentId)
        }
      }
    )

    // Post result
    const resultComment = [
      `✅ 任务执行完成！`,
      ``,
      `### 🔍 分析`,
      result.analysis.substring(0, 500),
      ``,
      `### 📋 计划`,
      result.plan.substring(0, 500),
      ``,
      `### ⚙️ 解决方案`,
      result.solution.substring(0, 2000),
    ].join('\n')

    await addComment(task.issueId, resultComment, task.agentId)

    // Update issue status to in_review
    await updateIssueStatus(task.issueId, 'in_review')

    task.status = 'completed'
    task.result = result.solution
    task.completedAt = new Date().toISOString()

    console.log(`[daemon] Task ${task.id} completed successfully`)
  } catch (error: any) {
    task.status = 'failed'
    task.error = error.message || 'Unknown error'
    task.completedAt = new Date().toISOString()

    // Post error comment
    await addComment(task.issueId, `❌ 任务执行失败: ${task.error}`, task.agentId)

    console.error(`[daemon] Task ${task.id} failed:`, error)
  } finally {
    runningCount--
  }
}

// ==========================================
// HTTP Handler
// ==========================================

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const url = req.url || '/'
  const method = req.method || 'GET'

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  try {
    // Health check
    if (url === '/api/health' && method === 'GET') {
      sendJson(res, {
        status: 'ok',
        daemonId,
        uptime: process.uptime(),
        tasks: { running: runningCount, total: tasks.size },
        tools: detectedTools.filter(t => t.available).map(t => t.name),
      })
      return
    }

    // Get detected tools
    if (url === '/api/tools' && method === 'GET') {
      detectedTools = await detectTools(true)
      sendJson(res, { tools: detectedTools })
      return
    }

    // Execute a task
    if (url === '/api/execute' && method === 'POST') {
      const body = await parseBody(req)
      const { issueId, agentId, taskDescription, scene } = body

      if (!issueId || !agentId || !taskDescription) {
        sendJson(res, { error: 'issueId, agentId, and taskDescription are required' }, 400)
        return
      }

      if (runningCount >= MAX_CONCURRENT_TASKS) {
        sendJson(res, { error: 'Max concurrent tasks reached', runningCount }, 429)
        return
      }

      // Get agent config from platform
      const agentData = await callPlatform('GET', `/api/members/${agentId}`)
      if (!agentData || agentData.type !== 'agent') {
        sendJson(res, { error: 'Agent not found' }, 404)
        return
      }

      const agentConfig: AgentConfig = {
        agentId: agentData.id,
        agentName: agentData.name,
        systemPrompt: agentData.systemPrompt || undefined,
        capabilities: agentData.capabilities ? JSON.parse(agentData.capabilities) : undefined,
        scene: scene || undefined,
      }

      // Create task
      const task: Task = {
        id: generateId(),
        issueId,
        agentId,
        description: taskDescription,
        status: 'pending',
        workspaceDir: '',
        scene,
      }

      tasks.set(task.id, task)

      // Update issue status to in_progress
      await updateIssueStatus(issueId, 'in_progress')

      // Run task asynchronously
      runTask(task, agentConfig).catch(err => {
        console.error(`[daemon] Unhandled task error:`, err)
      })

      sendJson(res, { taskId: task.id, status: 'started' }, 201)
      return
    }

    // Get task status
    if (url.startsWith('/api/tasks/') && method === 'GET') {
      const taskId = url.split('/api/tasks/')[1]
      const task = tasks.get(taskId)
      if (!task) {
        sendJson(res, { error: 'Task not found' }, 404)
        return
      }
      sendJson(res, task)
      return
    }

    // List all tasks
    if (url === '/api/tasks' && method === 'GET') {
      sendJson(res, { tasks: Array.from(tasks.values()), running: runningCount })
      return
    }

    // Abort a task
    if (url.startsWith('/api/abort/') && method === 'POST') {
      const taskId = url.split('/api/abort/')[1]
      const task = tasks.get(taskId)
      if (!task) {
        sendJson(res, { error: 'Task not found' }, 404)
        return
      }
      if (task.status !== 'running') {
        sendJson(res, { error: 'Task is not running' }, 400)
        return
      }
      task.status = 'aborted'
      task.completedAt = new Date().toISOString()
      sendJson(res, { taskId, status: 'aborted' })
      return
    }

    // List workspaces
    if (url === '/api/workspaces' && method === 'GET') {
      const workspaces = await listWorkspaces()
      sendJson(res, { workspaces })
      return
    }

    // 404
    sendJson(res, { error: 'Not found' }, 404)
  } catch (error: any) {
    console.error('[daemon] Request handler error:', error)
    sendJson(res, { error: 'Internal server error' }, 500)
  }
}

// ==========================================
// Registration & Heartbeat
// ==========================================

async function registerWithPlatform() {
  const toolNames = await getAvailableToolNames()

  const result = await callPlatform('POST', '/api/daemons', {
    name: `daemon-${PORT}`,
    host: 'localhost',
    port: PORT,
    status: 'online',
    availableTools: toolNames,
    lastHeartbeat: new Date().toISOString(),
  })

  if (result) {
    daemonId = result.id
    console.log(`[daemon] Registered with platform, id: ${daemonId}`)
  } else {
    console.warn('[daemon] Failed to register with platform, will retry on heartbeat')
  }
}

async function sendHeartbeat() {
  if (!daemonId) {
    await registerWithPlatform()
    return
  }

  const toolNames = await getAvailableToolNames(false)

  await callPlatform('PATCH', `/api/daemons/${daemonId}`, {
    status: 'online',
    availableTools: toolNames,
    lastHeartbeat: new Date().toISOString(),
  })

  console.log(`[daemon] Heartbeat sent (running: ${runningCount}, tasks: ${tasks.size})`)
}

// ==========================================
// Startup
// ==========================================

async function start() {
  console.log('[daemon] AgentTeam Daemon Service starting...')

  // Detect CLI tools
  console.log('[daemon] Detecting CLI tools...')
  detectedTools = await detectTools()
  const available = detectedTools.filter(t => t.available)
  console.log(`[daemon] Found ${available.length} tools: ${available.map(t => `${t.name}@${t.version || '?'}`).join(', ')}`)

  // Create HTTP server
  const server = createServer(handleRequest)

  server.listen(PORT, () => {
    console.log(`[daemon] HTTP server listening on port ${PORT}`)
  })

  // Register with main platform
  await registerWithPlatform()

  // Start heartbeat
  heartbeatInterval = setInterval(sendHeartbeat, 30000)
  console.log('[daemon] Heartbeat started (every 30s)')

  console.log('[daemon] ✅ AgentTeam Daemon Service ready!')
}

// Graceful shutdown
async function shutdown() {
  console.log('[daemon] Shutting down...')

  if (heartbeatInterval) clearInterval(heartbeatInterval)

  // Update daemon status to offline
  if (daemonId) {
    await callPlatform('PATCH', `/api/daemons/${daemonId}`, {
      status: 'offline',
      lastHeartbeat: new Date().toISOString(),
    })
  }

  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

// Start!
start().catch(err => {
  console.error('[daemon] Fatal error:', err)
  process.exit(1)
})
