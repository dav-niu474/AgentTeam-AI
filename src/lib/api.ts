// AgentTeam 协作平台 - API Helper Functions
// 所有API调用的类型安全封装

// ============ Type Definitions ============

export interface Member {
  id: string
  type: 'human' | 'agent'
  name: string
  avatar: string | null
  email: string | null
  createdAt: string
  updatedAt: string
  role: string | null
  capabilities: string | null
  agentGroup: string | null
  daemonId: string | null
  agentStatus: string | null
  description: string | null
  systemPrompt: string | null
  skills?: AgentSkillWithSkill[]
  createdIssues?: { id: string; title: string; status: string }[]
  assignedIssues?: { id: string; title: string; status: string }[]
}

export interface AgentSkillWithSkill {
  id: string
  agentId: string
  skillId: string
  createdAt: string
  skill: Skill
}

export interface Issue {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  scene: string | null
  labels: string | null
  creatorId: string
  assigneeId: string | null
  inspirationId: string | null
  parentIssueId: string | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  creator?: {
    id: string
    name: string
    type: string
    avatar: string | null
    agentStatus?: string | null
  }
  assignee?: {
    id: string
    name: string
    type: string
    avatar: string | null
    agentStatus?: string | null
  } | null
  inspiration?: {
    id: string
    content: string
    status: string
  } | null
  _count?: {
    comments: number
    childIssues: number
    sessions: number
  }
  comments?: Comment[]
  sessions?: Session[]
}

export interface Comment {
  id: string
  content: string
  authorId: string
  issueId: string
  authorType: string
  metadata: string | null
  createdAt: string
  updatedAt: string
  author?: {
    id: string
    name: string
    type?: string
    avatar: string | null
  }
}

export interface Session {
  id: string
  agentId: string
  issueId: string
  status: string
  messages: string
  workingDir: string | null
  gitBranch: string | null
  context: string | null
  createdAt: string
  updatedAt: string
  agent?: { id: string; name: string; type: string; avatar: string | null }
  issue?: { id: string; title: string; status: string }
}

export interface SessionDetail extends Session {
  messages: unknown[]
  context: unknown
  agent?: { id: string; name: string; type: string; avatar: string | null; capabilities?: string | null }
  issue?: { id: string; title: string; description?: string | null; status: string; priority?: string; scene?: string | null }
}

export interface Inspiration {
  id: string
  content: string
  source: string
  status: string
  creatorId: string
  createdAt: string
  updatedAt: string
  analysisResult: string | null
  analyzedAt: string | null
  creator?: Member
  issues?: Issue[]
}

export interface Skill {
  id: string
  name: string
  description: string
  promptTemplate: string
  requiredTools: string | null
  acceptanceCriteria: string | null
  version: number
  usageCount: number
  isBuiltIn: boolean
  scene: string | null
  createdAt: string
  updatedAt: string
  agentSkills?: { id: string; agentId: string; skillId: string; agent: { id: string; name: string; avatar: string | null; agentStatus?: string | null } }[]
  _count?: { agentSkills: number }
}

export interface Daemon {
  id: string
  name: string
  host: string | null
  port: number | null
  status: string
  availableTools: string | null
  lastHeartbeat: string | null
  createdAt: string
  updatedAt: string
}

export interface AuditLog {
  id: string
  actorId: string
  actorType: string
  action: string
  targetType: string
  targetId: string
  details: string | null
  createdAt: string
  actor?: { id: string; name: string; type: string; avatar: string | null }
}

export interface AuditLogResponse {
  data: AuditLog[]
  total: number
  limit: number
  offset: number
}

export interface MemoryEntry {
  id: string
  userId: string
  category: string
  key: string
  value: string
  confidence: number
  source: string | null
  createdAt: string
  updatedAt: string
}

export interface Stats {
  issues: {
    total: number
    byStatus: Record<string, number>
  }
  agents: {
    total: number
    byStatus: { online: number; busy: number; offline: number }
  }
  humans: { total: number }
  inspirations: {
    total: number
    byStatus: Record<string, number>
  }
  sessions: { active: number }
  daemons: { online: number }
  recentActivity: AuditLog[]
}

// ============ Generic Fetch Helper ============

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || `API Error: ${res.status}`)
  }
  return res.json()
}

// ============ Stats ============

export const statsApi = {
  get: () => apiFetch<Stats>('/api/stats'),
}

// ============ Members ============

export interface MembersParams {
  type?: 'human' | 'agent'
}

export interface CreateMemberData {
  type?: 'human' | 'agent'
  name: string
  avatar?: string
  email?: string
  role?: string
  capabilities?: string[]
  agentGroup?: string
  daemonId?: string
  agentStatus?: string
  description?: string
  systemPrompt?: string
}

export interface UpdateMemberData {
  name?: string
  avatar?: string
  email?: string
  role?: string
  capabilities?: string[]
  agentGroup?: string
  daemonId?: string
  agentStatus?: string
  description?: string
  systemPrompt?: string
}

export const membersApi = {
  list: (params?: MembersParams) => {
    const search = new URLSearchParams()
    if (params?.type) search.set('type', params.type)
    const query = search.toString()
    return apiFetch<Member[]>(`/api/members${query ? `?${query}` : ''}`)
  },
  get: (id: string) => apiFetch<Member>(`/api/members/${id}`),
  create: (data: CreateMemberData) =>
    apiFetch<Member>('/api/members', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: UpdateMemberData) =>
    apiFetch<Member>(`/api/members/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/members/${id}`, { method: 'DELETE' }),
}

// ============ Issues ============

export interface IssuesParams {
  status?: string
  assigneeId?: string
  creatorId?: string
  priority?: string
  scene?: string
}

export interface CreateIssueData {
  title: string
  description?: string
  status?: string
  priority?: string
  scene?: string
  labels?: string[]
  creatorId: string
  assigneeId?: string
  inspirationId?: string
  parentIssueId?: string
}

export interface UpdateIssueData {
  title?: string
  description?: string
  priority?: string
  scene?: string
  labels?: string[]
  assigneeId?: string | null
  actorId?: string
}

export interface IssueStatusTransition {
  status: string
}

export const issuesApi = {
  list: (params?: IssuesParams) => {
    const search = new URLSearchParams()
    if (params?.status) search.set('status', params.status)
    if (params?.assigneeId) search.set('assigneeId', params.assigneeId)
    if (params?.creatorId) search.set('creatorId', params.creatorId)
    if (params?.priority) search.set('priority', params.priority)
    if (params?.scene) search.set('scene', params.scene)
    const query = search.toString()
    return apiFetch<Issue[]>(`/api/issues${query ? `?${query}` : ''}`)
  },
  get: (id: string) => apiFetch<Issue>(`/api/issues/${id}`),
  create: (data: CreateIssueData) =>
    apiFetch<Issue>('/api/issues', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: UpdateIssueData) =>
    apiFetch<Issue>(`/api/issues/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/issues/${id}`, { method: 'DELETE' }),
  updateStatus: (id: string, data: IssueStatusTransition) =>
    apiFetch<Issue>(`/api/issues/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }),
}

// ============ Comments ============

export interface CommentsParams {
  issueId?: string
}

export interface CreateCommentData {
  content: string
  authorId: string
  issueId: string
  authorType?: string
  metadata?: unknown
}

export const commentsApi = {
  list: (params?: CommentsParams) => {
    const search = new URLSearchParams()
    if (params?.issueId) search.set('issueId', params.issueId)
    const query = search.toString()
    return apiFetch<Comment[]>(`/api/comments${query ? `?${query}` : ''}`)
  },
  create: (data: CreateCommentData) =>
    apiFetch<Comment>('/api/comments', { method: 'POST', body: JSON.stringify(data) }),
}

// ============ Sessions ============

export interface SessionsParams {
  agentId?: string
  issueId?: string
  status?: string
}

export interface CreateSessionData {
  agentId: string
  issueId: string
  workingDir?: string
  gitBranch?: string
  context?: unknown
  status?: string
}

export interface UpdateSessionData {
  messages?: unknown[]
  workingDir?: string
  gitBranch?: string
  context?: unknown
  status?: string
}

export const sessionsApi = {
  list: (params?: SessionsParams) => {
    const search = new URLSearchParams()
    if (params?.agentId) search.set('agentId', params.agentId)
    if (params?.issueId) search.set('issueId', params.issueId)
    if (params?.status) search.set('status', params.status)
    const query = search.toString()
    return apiFetch<Session[]>(`/api/sessions${query ? `?${query}` : ''}`)
  },
  get: (id: string) => apiFetch<SessionDetail>(`/api/sessions/${id}`),
  create: (data: CreateSessionData) =>
    apiFetch<Session>('/api/sessions', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: UpdateSessionData) =>
    apiFetch<Session>(`/api/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
}

// ============ Inspirations ============

export interface InspirationsParams {
  status?: string
}

export interface CreateInspirationData {
  content: string
  source?: string
  creatorId: string
}

export const inspirationsApi = {
  list: (params?: InspirationsParams) => {
    const search = new URLSearchParams()
    if (params?.status) search.set('status', params.status)
    const query = search.toString()
    return apiFetch<Inspiration[]>(`/api/inspirations${query ? `?${query}` : ''}`)
  },
  get: (id: string) => apiFetch<Inspiration>(`/api/inspirations/${id}`),
  create: (data: CreateInspirationData) =>
    apiFetch<Inspiration>('/api/inspirations', { method: 'POST', body: JSON.stringify(data) }),
  analyze: (id: string) =>
    apiFetch<Inspiration>(`/api/inspirations/${id}/analyze`, { method: 'POST' }),
}

// ============ Skills ============

export interface SkillsParams {
  scene?: string
  isBuiltIn?: boolean
}

export interface CreateSkillData {
  name: string
  description: string
  promptTemplate: string
  requiredTools?: string[]
  acceptanceCriteria?: string
  isBuiltIn?: boolean
  scene?: string
}

export interface UpdateSkillData {
  name?: string
  description?: string
  promptTemplate?: string
  requiredTools?: string[]
  acceptanceCriteria?: string
  version?: number
  usageCount?: number
  isBuiltIn?: boolean
  scene?: string
}

export const skillsApi = {
  list: (params?: SkillsParams) => {
    const search = new URLSearchParams()
    if (params?.scene) search.set('scene', params.scene)
    if (params?.isBuiltIn !== undefined) search.set('isBuiltIn', String(params.isBuiltIn))
    const query = search.toString()
    return apiFetch<Skill[]>(`/api/skills${query ? `?${query}` : ''}`)
  },
  get: (id: string) => apiFetch<Skill>(`/api/skills/${id}`),
  create: (data: CreateSkillData) =>
    apiFetch<Skill>('/api/skills', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: UpdateSkillData) =>
    apiFetch<Skill>(`/api/skills/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/skills/${id}`, { method: 'DELETE' }),
}

// ============ Daemons ============

export interface CreateDaemonData {
  name: string
  host?: string
  port?: number
  availableTools?: string[]
  status?: string
}

export interface UpdateDaemonData {
  name?: string
  host?: string
  port?: number
  status?: string
  availableTools?: string[]
}

export const daemonsApi = {
  list: () => apiFetch<Daemon[]>('/api/daemons'),
  get: (id: string) => apiFetch<Daemon>(`/api/daemons/${id}`),
  create: (data: CreateDaemonData) =>
    apiFetch<Daemon>('/api/daemons', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: UpdateDaemonData) =>
    apiFetch<Daemon>(`/api/daemons/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
}

// ============ Audit Logs ============

export interface AuditLogsParams {
  actorId?: string
  action?: string
  targetType?: string
  targetId?: string
  limit?: number
  offset?: number
}

export const auditLogsApi = {
  list: (params?: AuditLogsParams) => {
    const search = new URLSearchParams()
    if (params?.actorId) search.set('actorId', params.actorId)
    if (params?.action) search.set('action', params.action)
    if (params?.targetType) search.set('targetType', params.targetType)
    if (params?.targetId) search.set('targetId', params.targetId)
    if (params?.limit) search.set('limit', String(params.limit))
    if (params?.offset) search.set('offset', String(params.offset))
    const query = search.toString()
    return apiFetch<AuditLogResponse>(`/api/audit-logs${query ? `?${query}` : ''}`)
  },
}

// ============ Memory ============

export interface MemoryParams {
  userId: string
  category?: string
}

export interface CreateMemoryData {
  userId: string
  category: string
  key: string
  value: string
  confidence?: number
  source?: string
}

export interface UpdateMemoryData {
  value?: string
  confidence?: number
  source?: string
  category?: string
  key?: string
}

export const memoryApi = {
  list: (params: MemoryParams) => {
    const search = new URLSearchParams()
    search.set('userId', params.userId)
    if (params.category) search.set('category', params.category)
    return apiFetch<MemoryEntry[]>(`/api/memory?${search.toString()}`)
  },
  get: (id: string) => apiFetch<MemoryEntry>(`/api/memory/${id}`),
  create: (data: CreateMemoryData) =>
    apiFetch<MemoryEntry>('/api/memory', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: UpdateMemoryData) =>
    apiFetch<MemoryEntry>(`/api/memory/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/memory/${id}`, { method: 'DELETE' }),
}

// ============ Helper: Parse JSON fields ============

export function parseJsonField<T>(field: string | null, fallback: T): T {
  if (!field) return fallback
  try {
    return JSON.parse(field) as T
  } catch {
    return fallback
  }
}

// ============ Type Aliases (compatibility) ============

/** @deprecated Use Issue instead */
export type IssueItem = Issue
/** @deprecated Use Member instead */
export type MemberItem = Member
