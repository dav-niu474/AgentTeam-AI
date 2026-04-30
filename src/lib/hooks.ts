// AgentTeam 协作平台 - React Query Hooks
// 所有数据获取和变更的 React Query 封装

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  statsApi,
  membersApi,
  issuesApi,
  commentsApi,
  sessionsApi,
  inspirationsApi,
  skillsApi,
  daemonsApi,
  auditLogsApi,
  memoryApi,
  type MembersParams,
  type CreateMemberData,
  type UpdateMemberData,
  type IssuesParams,
  type CreateIssueData,
  type UpdateIssueData,
  type IssueStatusTransition,
  type CommentsParams,
  type CreateCommentData,
  type SessionsParams,
  type CreateSessionData,
  type UpdateSessionData,
  type InspirationsParams,
  type CreateInspirationData,
  type SkillsParams,
  type CreateSkillData,
  type UpdateSkillData,
  type CreateDaemonData,
  type UpdateDaemonData,
  type AuditLogsParams,
  type MemoryParams,
  type CreateMemoryData,
  type UpdateMemoryData,
} from '@/lib/api'

// ============ Query Key Factory ============

export const queryKeys = {
  stats: ['stats'] as const,
  members: (params?: MembersParams) => ['members', params] as const,
  member: (id: string) => ['members', id] as const,
  issues: (params?: IssuesParams) => ['issues', params] as const,
  issue: (id: string) => ['issues', id] as const,
  comments: (params?: CommentsParams) => ['comments', params] as const,
  sessions: (params?: SessionsParams) => ['sessions', params] as const,
  session: (id: string) => ['sessions', id] as const,
  inspirations: (params?: InspirationsParams) => ['inspirations', params] as const,
  inspiration: (id: string) => ['inspirations', id] as const,
  skills: (params?: SkillsParams) => ['skills', params] as const,
  skill: (id: string) => ['skills', id] as const,
  daemons: ['daemons'] as const,
  daemon: (id: string) => ['daemons', id] as const,
  auditLogs: (params?: AuditLogsParams) => ['auditLogs', params] as const,
  memory: (params: MemoryParams) => ['memory', params] as const,
}

// ============ Stats Hooks ============

export function useStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: () => statsApi.get(),
    refetchOnMount: 'always',
  })
}

// ============ Members Hooks ============

export function useMembers(params?: MembersParams) {
  return useQuery({
    queryKey: queryKeys.members(params),
    queryFn: () => membersApi.list(params),
    refetchOnMount: 'always',
  })
}

export function useMember(id: string) {
  return useQuery({
    queryKey: queryKeys.member(id),
    queryFn: () => membersApi.get(id),
    enabled: !!id,
  })
}

export function useAgents() {
  return useMembers({ type: 'agent' })
}

export function useHumans() {
  return useMembers({ type: 'human' })
}

export function useCreateMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateMemberData) => membersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats })
    },
  })
}

export function useUpdateMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMemberData }) =>
      membersApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.member(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats })
    },
  })
}

export function useDeleteMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => membersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats })
    },
  })
}

// ============ Issues Hooks ============

export function useIssues(params?: IssuesParams) {
  return useQuery({
    queryKey: queryKeys.issues(params),
    queryFn: () => issuesApi.list(params),
    refetchOnMount: 'always',
  })
}

export function useIssue(id: string) {
  return useQuery({
    queryKey: queryKeys.issue(id),
    queryFn: () => issuesApi.get(id),
    enabled: !!id,
  })
}

export function useCreateIssue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateIssueData) => issuesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats })
    },
  })
}

export function useUpdateIssue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateIssueData }) =>
      issuesApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['issues'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.issue(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats })
    },
  })
}

export function useDeleteIssue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => issuesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats })
    },
  })
}

export function useUpdateIssueStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: IssueStatusTransition }) =>
      issuesApi.updateStatus(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['issues'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.issue(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats })
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] })
    },
  })
}

// ============ Comments Hooks ============

export function useComments(paramsOrIssueId?: CommentsParams | string, _enabled?: boolean) {
  const params = typeof paramsOrIssueId === 'string'
    ? { issueId: paramsOrIssueId }
    : paramsOrIssueId
  return useQuery({
    queryKey: queryKeys.comments(params),
    queryFn: () => commentsApi.list(params),
    enabled: !!params?.issueId,
  })
}

export function useCreateComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateCommentData) => commentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] })
      queryClient.invalidateQueries({ queryKey: ['issues'] })
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] })
    },
  })
}

// ============ Sessions Hooks ============

export function useSessions(params?: SessionsParams) {
  return useQuery({
    queryKey: queryKeys.sessions(params),
    queryFn: () => sessionsApi.list(params),
  })
}

export function useSession(id: string) {
  return useQuery({
    queryKey: queryKeys.session(id),
    queryFn: () => sessionsApi.get(id),
    enabled: !!id,
  })
}

export function useCreateSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateSessionData) => sessionsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })
}

export function useUpdateSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSessionData }) =>
      sessionsApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.session(id) })
    },
  })
}

// ============ Inspirations Hooks ============

export function useInspirations(params?: InspirationsParams) {
  return useQuery({
    queryKey: queryKeys.inspirations(params),
    queryFn: () => inspirationsApi.list(params),
  })
}

export function useCreateInspiration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateInspirationData) => inspirationsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspirations'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats })
    },
  })
}

export function useAnalyzeInspiration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => inspirationsApi.analyze(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspirations'] })
      queryClient.invalidateQueries({ queryKey: ['issues'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats })
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] })
    },
  })
}

// ============ Skills Hooks ============

export function useSkills(params?: SkillsParams) {
  return useQuery({
    queryKey: queryKeys.skills(params),
    queryFn: () => skillsApi.list(params),
  })
}

export function useSkill(id: string) {
  return useQuery({
    queryKey: queryKeys.skill(id),
    queryFn: () => skillsApi.get(id),
    enabled: !!id,
  })
}

export function useCreateSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateSkillData) => skillsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
  })
}

export function useUpdateSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSkillData }) =>
      skillsApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.skill(id) })
    },
  })
}

export function useDeleteSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => skillsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
  })
}

// ============ Daemons Hooks ============

export function useDaemons() {
  return useQuery({
    queryKey: queryKeys.daemons,
    queryFn: () => daemonsApi.list(),
  })
}

export function useDaemon(id: string) {
  return useQuery({
    queryKey: queryKeys.daemon(id),
    queryFn: () => daemonsApi.get(id),
    enabled: !!id,
  })
}

export function useCreateDaemon() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateDaemonData) => daemonsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.daemons })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats })
    },
  })
}

export function useUpdateDaemon() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDaemonData }) =>
      daemonsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.daemons })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats })
    },
  })
}

// ============ Audit Logs Hooks ============

export function useAuditLogs(params?: AuditLogsParams) {
  return useQuery({
    queryKey: queryKeys.auditLogs(params),
    queryFn: () => auditLogsApi.list(params),
  })
}

// ============ Memory Hooks ============

export function useMemory(params: MemoryParams) {
  return useQuery({
    queryKey: queryKeys.memory(params),
    queryFn: () => memoryApi.list(params),
    enabled: !!params.userId,
  })
}

export function useCreateMemory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateMemoryData) => memoryApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memory'] })
    },
  })
}

export function useUpdateMemory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMemoryData }) =>
      memoryApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memory'] })
    },
  })
}

export function useDeleteMemory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => memoryApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memory'] })
    },
  })
}

// ============ Compatibility Aliases ============

// Re-export type aliases for board-view compatibility
export type { IssueItem, MemberItem } from '@/lib/api'

/**
 * useChangeIssueStatus - Compatibility hook for board-view
 * Accepts { id, status, actorId } directly
 */
export function useChangeIssueStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string; actorId?: string }) =>
      issuesApi.updateStatus(id, { status }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['issues'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.issue(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats })
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] })
    },
  })
}
