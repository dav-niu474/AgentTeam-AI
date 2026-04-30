'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  Monitor,
  Bot,
  GitBranch,
  FolderOpen,
  Clock,
  MessageSquare,
  Play,
  StopCircle,
  Eye,
  Filter,
  Search,
  X,
  Loader2,
  Terminal,
  Pause,
  CheckCircle2,
  Circle,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  useSessions,
  useSession,
  useUpdateSession,
  useAgents,
} from '@/lib/hooks'
import type { Session } from '@/lib/api'
import { toast } from 'sonner'

// ==========================================
// Constants
// ==========================================

const SESSION_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  active: { label: '活跃', color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/30', icon: Circle },
  paused: { label: '暂停', color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/30', icon: Pause },
  completed: { label: '已完成', color: 'text-green-600', bg: 'bg-green-500/10 border-green-500/30', icon: CheckCircle2 },
}

const ISSUE_STATUS_LABELS: Record<string, string> = {
  open: '待处理',
  triaged: '已分诊',
  in_progress: '进行中',
  in_review: '待审查',
  resolved: '已解决',
  closed: '已关闭',
}

// ==========================================
// Session Detail Dialog (Message History)
// ==========================================

interface SessionMessage {
  role: string
  content: string
  timestamp?: string
}

function SessionDetailDialog({
  sessionId,
  open,
  onOpenChange,
}: {
  sessionId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: sessionDetail, isLoading } = useSession(sessionId || '')

  const messages = useMemo(() => {
    if (!sessionDetail?.messages) return []
    const raw = sessionDetail.messages
    if (Array.isArray(raw)) return raw as SessionMessage[]
    return []
  }, [sessionDetail])

  const getMessageStyle = (role: string) => {
    switch (role) {
      case 'assistant':
      case 'agent':
        return 'justify-start'
      case 'human':
      case 'user':
        return 'justify-end'
      case 'system':
        return 'justify-center'
      default:
        return 'justify-start'
    }
  }

  const getMessageBubbleStyle = (role: string) => {
    switch (role) {
      case 'assistant':
      case 'agent':
        return 'bg-primary/10 border border-primary/20 text-foreground rounded-2xl rounded-bl-sm'
      case 'human':
      case 'user':
        return 'bg-blue-500/10 border border-blue-500/20 text-foreground rounded-2xl rounded-br-sm'
      case 'system':
        return 'bg-muted border border-border text-muted-foreground text-xs rounded-xl'
      default:
        return 'bg-muted border border-border rounded-2xl'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="size-5 text-primary" />
            会话详情
          </DialogTitle>
          <DialogDescription>
            {sessionDetail?.agent?.name || 'Agent'} · {sessionDetail?.issue?.title || 'Issue'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-12 w-2/3 ml-auto" />
            <Skeleton className="h-8 w-1/2 mx-auto" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageSquare className="size-10 mb-3 opacity-30" />
            <p className="text-sm">暂无消息记录</p>
            <p className="text-xs mt-1">此会话尚未开始对话</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 max-h-[50vh]">
            <div className="space-y-3 py-2">
              {messages.map((msg, idx) => {
                const isSystem = msg.role === 'system'
                const isHuman = msg.role === 'human' || msg.role === 'user'
                const isAgent = msg.role === 'assistant' || msg.role === 'agent'

                return (
                  <div key={idx} className={`flex ${getMessageStyle(msg.role)}`}>
                    <div className={`flex gap-2 max-w-[85%] ${isHuman ? 'flex-row-reverse' : ''}`}>
                      {isAgent && (
                        <Avatar className="size-6 mt-1 shrink-0">
                          <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                            <Bot className="size-3" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                      {isHuman && (
                        <Avatar className="size-6 mt-1 shrink-0">
                          <AvatarFallback className="text-[8px] bg-blue-500/10 text-blue-600">
                            <User className="size-3" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className={`${getMessageBubbleStyle(msg.role)} px-4 py-2.5`}>
                        {!isSystem && (
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-medium text-muted-foreground">
                              {isAgent ? (sessionDetail?.agent?.name || 'Agent') : 'You'}
                            </span>
                            {msg.timestamp && (
                              <span className="text-[9px] text-muted-foreground/60">
                                {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true, locale: zhCN })}
                              </span>
                            )}
                          </div>
                        )}
                        <p className={`text-sm whitespace-pre-wrap ${isSystem ? 'text-center' : ''}`}>
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}

        {/* Session Info Footer */}
        {sessionDetail && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t text-xs text-muted-foreground">
            {sessionDetail.workingDir && (
              <span className="flex items-center gap-1">
                <FolderOpen className="size-3" />
                {sessionDetail.workingDir}
              </span>
            )}
            {sessionDetail.gitBranch && (
              <span className="flex items-center gap-1">
                <GitBranch className="size-3" />
                {sessionDetail.gitBranch}
              </span>
            )}
            <span className="flex items-center gap-1">
              <MessageSquare className="size-3" />
              {messages.length} 条消息
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ==========================================
// Session Card Component
// ==========================================

function SessionCard({
  session,
  onViewSession,
  onResumeSession,
  onEndSession,
}: {
  session: Session & { messageCount?: number }
  onViewSession: (id: string) => void
  onResumeSession: (id: string) => void
  onEndSession: (id: string) => void
}) {
  const statusConfig = SESSION_STATUS_CONFIG[session.status] || SESSION_STATUS_CONFIG.active
  const StatusIcon = statusConfig.icon
  const messageCount = session.messageCount ?? 0

  return (
    <Card className={`hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 group border-l-[3px] ${session.status === 'active' ? 'border-l-emerald-500' : session.status === 'paused' ? 'border-l-amber-500' : 'border-l-gray-300'}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header: Agent + Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Avatar className="size-8">
              <AvatarImage src={session.agent?.avatar || undefined} />
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {session.agent?.type === 'agent' ? <Bot className="size-4" /> : session.agent?.name?.charAt(0).toUpperCase() || 'A'}
              </AvatarFallback>
            </Avatar>
            <div>
              <span className="text-sm font-medium">{session.agent?.name || 'Unknown Agent'}</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`size-1.5 rounded-full ${session.agent?.agentStatus === 'online' ? 'bg-emerald-500' : session.agent?.agentStatus === 'busy' ? 'bg-amber-500' : 'bg-gray-400'}`} />
                <span className="text-[10px] text-muted-foreground">
                  {session.agent?.agentStatus === 'online' ? '在线' : session.agent?.agentStatus === 'busy' ? '忙碌' : '离线'}
                </span>
              </div>
            </div>
          </div>
          <Badge variant="outline" className={`${statusConfig.bg} ${statusConfig.color} border text-[10px]`}>
            <StatusIcon className="size-3 mr-1" />
            {statusConfig.label}
          </Badge>
        </div>

        {/* Issue Info */}
        {session.issue && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/30">
            <div className={`size-2 rounded-full shrink-0 ${
              session.issue.status === 'in_progress' ? 'bg-emerald-500' :
              session.issue.status === 'in_review' ? 'bg-amber-500' :
              session.issue.status === 'resolved' ? 'bg-green-500' :
              'bg-slate-400'
            }`} />
            <span className="text-xs font-medium line-clamp-1 flex-1">{session.issue.title}</span>
            <Badge variant="secondary" className="text-[9px] shrink-0">
              {ISSUE_STATUS_LABELS[session.issue.status] || session.issue.status}
            </Badge>
          </div>
        )}

        {/* Details Row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {session.workingDir && (
            <span className="flex items-center gap-1" title={session.workingDir}>
              <FolderOpen className="size-3" />
              <span className="truncate max-w-[120px]">{session.workingDir.split('/').pop()}</span>
            </span>
          )}
          {session.gitBranch && (
            <span className="flex items-center gap-1">
              <GitBranch className="size-3" />
              {session.gitBranch}
            </span>
          )}
          <span className="flex items-center gap-1">
            <MessageSquare className="size-3" />
            {messageCount} 消息
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true, locale: zhCN })}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 border-t border-border/50">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1 flex-1"
            onClick={() => onViewSession(session.id)}
          >
            <Eye className="size-3" />
            查看会话
          </Button>
          {session.status === 'paused' && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 flex-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 border-emerald-500/30"
              onClick={() => onResumeSession(session.id)}
            >
              <Play className="size-3" />
              恢复
            </Button>
          )}
          {session.status === 'active' && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 flex-1 text-destructive hover:bg-destructive/10 border-destructive/30"
              onClick={() => onEndSession(session.id)}
            >
              <StopCircle className="size-3" />
              结束
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ==========================================
// Main Sessions View
// ==========================================

export function SessionsView() {
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterAgent, setFilterAgent] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const { data: sessions, isLoading } = useSessions()
  const { data: agents } = useAgents()
  const updateSessionMutation = useUpdateSession()

  const hasActiveFilters = filterStatus !== 'all' || filterAgent !== 'all' || searchQuery

  const filteredSessions = useMemo(() => {
    if (!sessions) return []
    return sessions.filter((session) => {
      if (filterStatus !== 'all' && session.status !== filterStatus) return false
      if (filterAgent !== 'all' && session.agentId !== filterAgent) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchAgent = session.agent?.name?.toLowerCase().includes(q)
        const matchIssue = session.issue?.title?.toLowerCase().includes(q)
        const matchBranch = session.gitBranch?.toLowerCase().includes(q)
        if (!matchAgent && !matchIssue && !matchBranch) return false
      }
      return true
    })
  }, [sessions, filterStatus, filterAgent, searchQuery])

  // Stats
  const stats = useMemo(() => {
    if (!sessions) return { active: 0, paused: 0, completed: 0, total: 0 }
    return {
      active: sessions.filter((s) => s.status === 'active').length,
      paused: sessions.filter((s) => s.status === 'paused').length,
      completed: sessions.filter((s) => s.status === 'completed').length,
      total: sessions.length,
    }
  }, [sessions])

  const handleViewSession = (id: string) => {
    setDetailSessionId(id)
    setDetailOpen(true)
  }

  const handleResumeSession = (id: string) => {
    updateSessionMutation.mutate(
      { id, data: { status: 'active' } },
      {
        onSuccess: () => toast.success('会话已恢复'),
        onError: () => toast.error('恢复会话失败'),
      }
    )
  }

  const handleEndSession = (id: string) => {
    updateSessionMutation.mutate(
      { id, data: { status: 'completed' } },
      {
        onSuccess: () => toast.success('会话已结束'),
        onError: () => toast.error('结束会话失败'),
      }
    )
  }

  return (
    <div className="flex flex-col h-full p-4 md:p-6">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Monitor className="size-6 text-primary" />
          Sessions
        </h1>
        <p className="text-muted-foreground mt-1">查看和管理 Agent 执行会话</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-emerald-500/10 flex items-center justify-center">
              <Circle className="size-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.active}</p>
              <p className="text-[10px] text-muted-foreground">活跃</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-amber-500/10 flex items-center justify-center">
              <Pause className="size-4 text-amber-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.paused}</p>
              <p className="text-[10px] text-muted-foreground">暂停</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="size-4 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.completed}</p>
              <p className="text-[10px] text-muted-foreground">已完成</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center">
              <Terminal className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.total}</p>
              <p className="text-[10px] text-muted-foreground">全部</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="搜索会话（Agent/任务/分支）..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="active">活跃</SelectItem>
            <SelectItem value="paused">暂停</SelectItem>
            <SelectItem value="completed">已完成</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterAgent} onValueChange={setFilterAgent}>
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部 Agent</SelectItem>
            {agents?.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => {
              setFilterStatus('all')
              setFilterAgent('all')
              setSearchQuery('')
            }}
          >
            <X className="size-3" />
            清除
          </Button>
        )}
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-4 space-y-3">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16 mt-1" />
                  </div>
                  <Skeleton className="h-5 w-14" />
                </div>
                <Skeleton className="h-8 w-full" />
                <div className="flex gap-3">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-7 flex-1" />
                  <Skeleton className="h-7 flex-1" />
                </div>
              </Card>
            ))}
          </div>
        ) : filteredSessions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-muted-foreground"
          >
            <Terminal className="size-14 mb-4 opacity-20 animate-bounce-subtle" />
            <p className="text-base font-medium mb-1">暂无会话记录</p>
            <p className="text-sm text-muted-foreground/70">
              {sessions && sessions.length > 0
                ? '尝试调整筛选条件查看更多会话'
                : '当 Agent 开始执行任务时，会话记录将出现在这里'}
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filteredSessions.map((session, idx) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: idx * 0.03 }}
                >
                  <SessionCard
                    session={session as Session & { messageCount?: number }}
                    onViewSession={handleViewSession}
                    onResumeSession={handleResumeSession}
                    onEndSession={handleEndSession}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Session Detail Dialog */}
      <SessionDetailDialog
        sessionId={detailSessionId}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setDetailSessionId(null)
        }}
      />
    </div>
  )
}
