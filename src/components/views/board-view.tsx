'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Kanban,
  Plus,
  Search,
  Filter,
  X,
  Send,
  Bot,
  User,
  Clock,
  AlertCircle,
  ChevronRight,
  GripVertical,
  Loader2,
  MessageSquare,
  Trash2,
  ArrowRight,
  Zap,
  Code,
  FileText,
  BarChart3,
  Eye,
  Play,
  Inbox,
  CircleDot,
  CheckCheck,
  CircleCheck,
  List,
  ArrowUpDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Checkbox as UICheckbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  useIssues,
  useAgents,
  useComments,
  useCreateIssue,
  useUpdateIssueStatus,
  useUpdateIssue,
  useCreateComment,
  useDeleteIssue,
} from '@/lib/hooks'
import { useCurrentUser } from '@/lib/use-current-user'
import { useAppStore, type BoardViewMode } from '@/lib/store'
import { parseJsonField } from '@/lib/api'
import type { Issue, Member } from '@/lib/api'
import { toast } from 'sonner'

// ==========================================
// Constants
// ==========================================

const STATUS_LABELS: Record<string, string> = {
  open: '待处理',
  triaged: '已分诊',
  in_progress: '进行中',
  in_review: '待审查',
  resolved: '已解决',
  closed: '已关闭',
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ['triaged', 'closed'],
  triaged: ['in_progress', 'closed'],
  in_progress: ['in_review', 'open'],
  in_review: ['resolved', 'in_progress'],
  resolved: ['closed', 'in_progress'],
  closed: ['open'],
}

const COLUMN_CONFIG = [
  { id: 'open', label: '待处理', color: 'bg-slate-400', accent: 'border-t-slate-400', icon: Inbox, bgPattern: 'bg-pattern-dots', wipLimit: 10 },
  { id: 'in_progress', label: '进行中', color: 'bg-emerald-500', accent: 'border-t-emerald-500', icon: CircleDot, bgPattern: 'bg-pattern-grid', wipLimit: 5 },
  { id: 'in_review', label: '待审查', color: 'bg-amber-500', accent: 'border-t-amber-500', icon: Eye, bgPattern: 'bg-pattern-dots', wipLimit: 5 },
  { id: 'resolved', label: '已解决', color: 'bg-green-500', accent: 'border-t-green-500', icon: CircleCheck, bgPattern: 'bg-pattern-grid', wipLimit: 20 },
]

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon?: React.ElementType }> = {
  urgent: { label: '紧急', color: 'text-red-600', bg: 'bg-red-500/10 border-red-500/30', border: 'border-l-red-500' },
  high: { label: '高', color: 'text-orange-600', bg: 'bg-orange-500/10 border-orange-500/30', border: 'border-l-orange-500' },
  medium: { label: '中', color: 'text-teal-600', bg: 'bg-teal-500/10 border-teal-500/30', border: 'border-l-teal-500' },
  low: { label: '低', color: 'text-gray-500', bg: 'bg-gray-500/10 border-gray-500/30', border: 'border-l-gray-400' },
}

const SCENE_LABELS: Record<string, string> = {
  'code-gen': '代码生成',
  doc: '文档',
  analysis: '分析',
  review: '审查',
  custom: '自定义',
}

const SCENE_ICONS: Record<string, React.ElementType> = {
  'code-gen': Code,
  doc: FileText,
  analysis: BarChart3,
  review: Eye,
  custom: Zap,
}

// ==========================================
// Issue Card Component
// ==========================================

function IssueCard({ issue, onClick, onQuickAction }: { issue: Issue; onClick: () => void; onQuickAction: (action: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
    data: { status: issue.status },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const priority = PRIORITY_CONFIG[issue.priority] || PRIORITY_CONFIG.medium
  const labels = parseJsonField<string[]>(issue.labels, [])
  const SceneIcon = (issue.scene && SCENE_ICONS[issue.scene]) || null
  const commentCount = issue._count?.comments || 0

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card
        className={`cursor-pointer transition-all duration-200 border-t-2 border-l-[3px] ${priority.border} ${COLUMN_CONFIG.find(c => c.id === issue.status)?.accent || ''} ${isDragging ? 'shadow-lg ring-2 ring-primary/20' : 'hover:shadow-md hover:-translate-y-0.5'} group relative hover:border-l-primary/50`}
        onClick={onClick}
      >
        <CardContent className="p-3 space-y-2">
          {/* Drag handle + Title */}
          <div className="flex items-start gap-1.5">
            <button {...listeners} className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground transition-colors">
              <GripVertical className="size-3.5" />
            </button>
            {SceneIcon && <SceneIcon className="size-3.5 mt-0.5 text-muted-foreground/60 shrink-0" />}
            <h3 className="text-sm font-medium leading-snug line-clamp-2 flex-1">{issue.title}</h3>
          </div>

          {/* Badges row */}
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priority.bg} ${priority.color} border`}>
              {priority.label}
            </Badge>
            {issue.scene && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {SCENE_LABELS[issue.scene] || issue.scene}
              </Badge>
            )}
            {labels.slice(0, 2).map((label) => (
              <Badge key={label} variant="secondary" className="text-[10px] px-1.5 py-0">
                {label}
              </Badge>
            ))}
          </div>

          {/* Footer: Assignee + comments + time */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {issue.assignee ? (
                <Avatar className="size-5 ring-1 ring-border/30">
                  <AvatarImage src={issue.assignee.avatar || undefined} />
                  <AvatarFallback className={`text-[8px] ${issue.assignee.type === 'agent' ? 'bg-primary/10 text-primary' : 'bg-teal-500/10 text-teal-600'}`}>
                    {issue.assignee.type === 'agent' ? <Bot className="size-2.5" /> : issue.assignee.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <span className="size-5 rounded-full bg-muted flex items-center justify-center">
                  <User className="size-3 text-muted-foreground" />
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">
                {issue.creator?.type === 'agent' ? `by ${issue.creator.name}` : 'by 你'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {commentCount > 0 && (
                <span className="flex items-center gap-0.5">
                  <MessageSquare className="size-3" />
                  {commentCount}
                </span>
              )}
              <span className="flex items-center gap-0.5">
                <Clock className="size-3" />
                {formatDistanceToNow(new Date(issue.createdAt), { addSuffix: false, locale: zhCN })}
              </span>
            </div>
          </div>

          {/* Quick Actions on Hover */}
          <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
            {issue.status === 'open' && (
              <button
                className="size-6 rounded-md bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 flex items-center justify-center transition-colors"
                onClick={(e) => { e.stopPropagation(); onQuickAction('start') }}
                title="开始处理"
              >
                <Play className="size-3" />
              </button>
            )}
            {issue.assigneeId && issue.status === 'in_progress' && (
              <button
                className="size-6 rounded-md bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center transition-colors"
                onClick={(e) => { e.stopPropagation(); onQuickAction('execute') }}
                title="执行任务"
              >
                <Zap className="size-3" />
              </button>
            )}
            <button
              className="size-6 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 flex items-center justify-center transition-colors"
              onClick={(e) => { e.stopPropagation(); onQuickAction('delete') }}
              title="删除"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ==========================================
// Kanban Column Component
// ==========================================

function KanbanColumn({
  config,
  issues,
  onIssueClick,
  onQuickAction,
}: {
  config: typeof COLUMN_CONFIG[number]
  issues: Issue[]
  onIssueClick: (issue: Issue) => void
  onQuickAction: (issue: Issue, action: string) => void
}) {
  const isOverWip = issues.length > config.wipLimit
  const ColumnIcon = config.icon

  return (
    <div className={`flex flex-col rounded-lg border border-border/50 bg-muted/20 min-w-[280px] md:min-w-0 overflow-hidden`}>
      <div className={`flex items-center gap-2 p-3 border-b border-border/50 border-t-2 ${config.accent}`}>
        <div className={`flex size-6 items-center justify-center rounded-md ${config.color.replace('bg-', 'bg-').replace('-400', '-500/10').replace('-500', '-500/10')}`}>
          <ColumnIcon className={`size-3.5 ${config.color.replace('bg-', 'text-')}`} />
        </div>
        <span className="text-sm font-medium">{config.label}</span>
        <Badge
          variant={isOverWip ? 'destructive' : 'secondary'}
          className={`text-[10px] ml-auto h-5 min-w-[20px] justify-center ${isOverWip ? 'animate-pulse' : ''}`}
        >
          {issues.length}
        </Badge>
        {config.wipLimit < 20 && (
          <span className="text-[10px] text-muted-foreground">
            /{config.wipLimit}
          </span>
        )}
      </div>
      <SortableContext items={issues.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <div className={`flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-240px)] ${config.bgPattern}`}>
          {issues.length > 0 ? (
            issues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onClick={() => onIssueClick(issue)}
                onQuickAction={(action) => onQuickAction(issue, action)}
              />
            ))
          ) : (
            <div className="flex items-center justify-center py-8 text-muted-foreground/50">
              <p className="text-xs">暂无任务</p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

// ==========================================
// Create Issue Dialog
// ==========================================

function CreateIssueDialog({
  open,
  onOpenChange,
  agents,
  userId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  agents: Member[]
  userId: string | null
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [scene, setScene] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const createMutation = useCreateIssue()

  const handleSubmit = () => {
    if (!title.trim() || !userId) return
    createMutation.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        scene: scene || undefined,
        creatorId: userId,
        assigneeId: assigneeId || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false)
          setTitle('')
          setDescription('')
          setPriority('medium')
          setScene('')
          setAssigneeId('')
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-5 text-primary" />
            新建 Issue
          </DialogTitle>
          <DialogDescription>创建一个新的任务到看板中</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">标题 *</label>
            <Input
              placeholder="输入任务标题..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">描述</label>
            <Textarea
              placeholder="描述任务的详细内容..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">优先级</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">紧急</SelectItem>
                  <SelectItem value="high">高</SelectItem>
                  <SelectItem value="medium">中</SelectItem>
                  <SelectItem value="low">低</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">场景</label>
              <Select value={scene} onValueChange={setScene}>
                <SelectTrigger>
                  <SelectValue placeholder="选择场景" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="code-gen">代码生成</SelectItem>
                  <SelectItem value="doc">文档</SelectItem>
                  <SelectItem value="analysis">分析</SelectItem>
                  <SelectItem value="review">审查</SelectItem>
                  <SelectItem value="custom">自定义</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">指派给</label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger>
                <SelectValue placeholder="选择 Agent（可选）" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <span className="flex items-center gap-2">
                      <Bot className="size-3" />
                      {agent.name}
                      <span className={`size-1.5 rounded-full ${agent.agentStatus === 'online' ? 'bg-emerald-500' : agent.agentStatus === 'busy' ? 'bg-amber-500' : 'bg-gray-400'}`} />
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!title.trim() || createMutation.isPending}
              className="gap-2"
            >
              {createMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              创建
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ==========================================
// Issue Detail Sheet
// ==========================================

function IssueDetailSheet({
  issue,
  open,
  onOpenChange,
  agents,
  userId,
}: {
  issue: Issue | null
  open: boolean
  onOpenChange: (open: boolean) => void
  agents: Member[]
  userId: string | null
}) {
  const [commentText, setCommentText] = useState('')
  const [executing, setExecuting] = useState(false)
  const changeStatusMutation = useUpdateIssueStatus()
  const updateIssueMutation = useUpdateIssue()
  const createCommentMutation = useCreateComment()
  const { data: commentsData, isLoading: commentsLoading } = useComments(issue?.id ? { issueId: issue.id } : undefined)

  if (!issue) return null

  const priority = PRIORITY_CONFIG[issue.priority] || PRIORITY_CONFIG.medium
  const labels = parseJsonField<string[]>(issue.labels, [])
  const validTransitions = VALID_TRANSITIONS[issue.status] || []
  const comments = commentsData || []
  const commentCount = issue._count?.comments || comments.length

  const handleStatusChange = (newStatus: string) => {
    changeStatusMutation.mutate(
      { id: issue.id, data: { status: newStatus } },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  const handleReassign = (newAssigneeId: string) => {
    updateIssueMutation.mutate({
      id: issue.id,
      data: { assigneeId: newAssigneeId === '__none__' ? null : newAssigneeId },
    })
  }

  const handleAddComment = () => {
    if (!commentText.trim() || !userId) return
    createCommentMutation.mutate(
      {
        content: commentText.trim(),
        authorId: userId,
        issueId: issue.id,
        authorType: 'human',
      },
      {
        onSuccess: () => setCommentText(''),
      }
    )
  }

  const handleExecuteTask = async () => {
    if (!issue.assigneeId) {
      toast.error('请先指派一个 Agent')
      return
    }
    setExecuting(true)
    try {
      const res = await fetch('/api/execute?XTransformPort=3003', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueId: issue.id,
          agentId: issue.assigneeId,
          taskDescription: issue.description || issue.title,
        }),
      })
      if (!res.ok) {
        throw new Error('执行请求失败')
      }
      toast.success('任务已提交执行')
    } catch {
      toast.error('执行请求失败，请检查 Daemon 是否在线')
    } finally {
      setExecuting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-3 pb-4">
          <SheetTitle className="text-lg leading-snug pr-6">{issue.title}</SheetTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={`${COLUMN_CONFIG.find(c => c.id === issue.status)?.accent} border-t-2`}>
              {STATUS_LABELS[issue.status] || issue.status}
            </Badge>
            <Badge variant="outline" className={`${priority.bg} ${priority.color} border`}>
              {priority.label}
            </Badge>
            {issue.scene && (
              <Badge variant="outline">{SCENE_LABELS[issue.scene] || issue.scene}</Badge>
            )}
            {labels.map((label) => (
              <Badge key={label} variant="secondary">{label}</Badge>
            ))}
          </div>
        </SheetHeader>

        <Separator className="mb-4" />

        {/* Execute Task Button */}
        {issue.assigneeId && (issue.status === 'in_progress' || issue.status === 'open' || issue.status === 'triaged') && (
          <Button
            className="w-full gap-2 mb-4 py-5 text-base bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-md hover:shadow-lg transition-all"
            onClick={handleExecuteTask}
            disabled={executing}
          >
            {executing ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Zap className="size-5" />
            )}
            {executing ? '执行中...' : '执行任务'}
          </Button>
        )}

        {/* Description */}
        <div className="mb-6">
          <h4 className="text-sm font-medium mb-2">描述</h4>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {issue.description || '暂无描述'}
          </p>
        </div>

        {/* Info */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <h4 className="text-sm font-medium mb-1">创建者</h4>
            <div className="flex items-center gap-2">
              <Avatar className="size-5">
                <AvatarFallback className={`text-[8px] ${issue.creator?.type === 'agent' ? 'bg-primary/10 text-primary' : 'bg-teal-500/10 text-teal-600'}`}>
                  {issue.creator?.type === 'agent' ? <Bot className="size-2.5" /> : issue.creator?.name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{issue.creator?.name || 'Unknown'}</span>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-1">指派给</h4>
            <Select
              value={issue.assigneeId || '__none__'}
              onValueChange={handleReassign}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">未指派</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Status Transitions */}
        {validTransitions.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium mb-2">状态变更</h4>
            <div className="flex flex-wrap gap-2">
              {validTransitions.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1 hover:-translate-y-0.5 transition-all hover:border-primary/30 hover:bg-primary/5"
                  onClick={() => handleStatusChange(s)}
                  disabled={changeStatusMutation.isPending}
                >
                  <ChevronRight className="size-3" />
                  {STATUS_LABELS[s] || s}
                </Button>
              ))}
            </div>
          </div>
        )}

        <Separator className="mb-4" />

        {/* Comments */}
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <MessageSquare className="size-4" />
            评论
            {commentCount > 0 && (
              <Badge variant="secondary" className="text-[10px]">{commentCount}</Badge>
            )}
          </h4>

          {commentsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : comments.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto mb-3">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-2.5">
                  <Avatar className="size-6 mt-0.5 ring-1 ring-border/30">
                    <AvatarFallback className={`text-[8px] ${comment.authorType === 'agent' ? 'bg-primary/10 text-primary' : comment.authorType === 'system' ? 'bg-amber-500/10 text-amber-600' : 'bg-teal-500/10 text-teal-600'}`}>
                      {comment.authorType === 'agent' ? <Bot className="size-3" /> : comment.author?.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{comment.author?.name || 'System'}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: zhCN })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-3 text-center">暂无评论</p>
          )}

          {/* Add comment */}
          {userId && (
            <div className="flex gap-2">
              <Input
                placeholder="添加评论..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleAddComment()
                  }
                }}
                className="text-sm"
              />
              <Button
                size="icon"
                onClick={handleAddComment}
                disabled={!commentText.trim() || createCommentMutation.isPending}
              >
                {createCommentMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Timestamps */}
        <div className="text-[10px] text-muted-foreground space-y-1 mt-4 pt-4 border-t">
          <p>创建于 {formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true, locale: zhCN })}</p>
          <p>更新于 {formatDistanceToNow(new Date(issue.updatedAt), { addSuffix: true, locale: zhCN })}</p>
          {issue.resolvedAt && (
            <p>解决于 {formatDistanceToNow(new Date(issue.resolvedAt), { addSuffix: true, locale: zhCN })}</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ==========================================
// Drag Overlay Card
// ==========================================

function DragOverlayCard({ issue }: { issue: Issue }) {
  const priority = PRIORITY_CONFIG[issue.priority] || PRIORITY_CONFIG.medium
  const SceneIcon = (issue.scene && SCENE_ICONS[issue.scene]) || null

  return (
    <Card className="shadow-2xl border-t-2 border-l-[3px] max-w-[320px] ring-2 ring-primary/20 bg-background/95 backdrop-blur-sm rotate-2">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-1.5">
          {SceneIcon && <SceneIcon className="size-3.5 mt-0.5 text-muted-foreground/60 shrink-0" />}
          <h3 className="text-sm font-medium line-clamp-2 flex-1">{issue.title}</h3>
        </div>
        <div className="flex gap-1">
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priority.bg} ${priority.color} border`}>
            {priority.label}
          </Badge>
          {issue.scene && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {SCENE_LABELS[issue.scene] || issue.scene}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ==========================================
// Main Board View
// ==========================================

export function BoardView() {
  const { user } = useCurrentUser()
  const userId = user?.id || null
  const { data: allIssues, isLoading: issuesLoading } = useIssues()
  const { data: agents } = useAgents()
  const { boardViewMode, setBoardViewMode } = useAppStore()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')

  // Table view state
  const [sortField, setSortField] = useState<'priority' | 'status' | 'createdAt' | 'title'>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const changeStatusMutation = useUpdateIssueStatus()
  const deleteIssueMutation = useDeleteIssue()

  const hasActiveFilters = searchQuery || filterAssignee !== 'all' || filterPriority !== 'all'

  const filteredIssues = useMemo(() => {
    if (!allIssues) return []
    return allIssues.filter((issue) => {
      if (searchQuery && !issue.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (filterAssignee !== 'all' && issue.assigneeId !== filterAssignee) return false
      if (filterPriority !== 'all' && issue.priority !== filterPriority) return false
      return true
    })
  }, [allIssues, searchQuery, filterAssignee, filterPriority])

  const columnIssues = useMemo(() => {
    const map: Record<string, Issue[]> = {}
    for (const col of COLUMN_CONFIG) {
      map[col.id] = filteredIssues.filter((i) => i.status === col.id)
    }
    // Also include triaged and closed issues in appropriate columns
    const triagedIssues = filteredIssues.filter((i) => i.status === 'triaged')
    const closedIssues = filteredIssues.filter((i) => i.status === 'closed')
    // Triaged goes with open, closed goes with resolved for visual simplicity
    map.open = [...map.open, ...triagedIssues]
    map.resolved = [...map.resolved, ...closedIssues]
    return map
  }, [filteredIssues])

  const handleIssueClick = useCallback((issue: Issue) => {
    setSelectedIssue(issue)
    setDetailOpen(true)
  }, [])

  const handleQuickAction = useCallback((issue: Issue, action: string) => {
    if (action === 'start') {
      // Move to in_progress
      const valid = VALID_TRANSITIONS[issue.status] || []
      if (valid.includes('in_progress')) {
        changeStatusMutation.mutate({ id: issue.id, data: { status: 'in_progress' } })
      } else if (valid.includes('triaged')) {
        changeStatusMutation.mutate({ id: issue.id, data: { status: 'triaged' } })
      }
    } else if (action === 'execute') {
      // Execute via daemon
      if (issue.assigneeId) {
        fetch('/api/execute?XTransformPort=3003', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            issueId: issue.id,
            agentId: issue.assigneeId,
            taskDescription: issue.description || issue.title,
          }),
        }).then(() => {
          toast.success('任务已提交执行')
        }).catch(() => {
          toast.error('执行请求失败')
        })
      }
    } else if (action === 'delete') {
      deleteIssueMutation.mutate(issue.id)
    }
  }, [changeStatusMutation, deleteIssueMutation])

  // DnD setup
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    // Find the target column
    const overId = over.id as string
    const targetColumn = COLUMN_CONFIG.find((col) => col.id === overId)

    if (targetColumn) {
      const issueId = active.id as string
      const issue = allIssues?.find((i) => i.id === issueId)
      if (issue && issue.status !== targetColumn.id) {
        // Check if transition is valid
        const validTransitions = VALID_TRANSITIONS[issue.status] || []
        if (validTransitions.includes(targetColumn.id)) {
          changeStatusMutation.mutate({
            id: issueId,
            data: { status: targetColumn.id },
          })
        }
      }
    }
  }

  const activeIssue = activeId ? allIssues?.find((i) => i.id === activeId) : null

  return (
    <div className="flex flex-col h-full p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Kanban className="size-6 text-primary" />
            Board
          </h1>
          <p className="text-muted-foreground mt-1">看板视图 - 拖拽管理任务状态</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-md border border-border/50 p-0.5">
            <Button
              variant={boardViewMode === 'kanban' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 gap-1.5 text-xs"
              onClick={() => setBoardViewMode('kanban')}
            >
              <Kanban className="size-3.5" />
              看板
            </Button>
            <Button
              variant={boardViewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 gap-1.5 text-xs"
              onClick={() => setBoardViewMode('table')}
            >
              <List className="size-3.5" />
              列表
            </Button>
          </div>

          <Button className="gap-2 hover:-translate-y-0.5 transition-all shadow-sm hover:shadow-md" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="size-4" />
            新建 Issue
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="搜索任务..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 h-8">
              <Filter className="size-3.5" />
              筛选
              {hasActiveFilters && (
                <span className="size-1.5 rounded-full bg-primary" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem className="cursor-default">
              <div className="w-full space-y-3 p-1">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">指派人</label>
                  <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部</SelectItem>
                      <SelectItem value="__none__">未指派</SelectItem>
                      {agents?.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">优先级</label>
                  <Select value={filterPriority} onValueChange={setFilterPriority}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部</SelectItem>
                      <SelectItem value="urgent">紧急</SelectItem>
                      <SelectItem value="high">高</SelectItem>
                      <SelectItem value="medium">中</SelectItem>
                      <SelectItem value="low">低</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs gap-1"
                    onClick={() => {
                      setSearchQuery('')
                      setFilterAssignee('all')
                      setFilterPriority('all')
                    }}
                  >
                    <X className="size-3" />
                    清除筛选
                  </Button>
                )}
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Board Content */}
      {issuesLoading ? (
        <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMN_CONFIG.map((col) => (
            <div key={col.id} className="flex flex-col rounded-lg border border-border/50 bg-muted/20">
              <div className="flex items-center gap-2 p-3 border-b border-border/50">
                <Skeleton className="size-2.5 rounded-full" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-6 ml-auto" />
              </div>
              <div className="flex-1 p-2 space-y-2">
                <Skeleton className="h-24 w-full shimmer" />
                <Skeleton className="h-24 w-full shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : boardViewMode === 'kanban' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4 overflow-hidden">
            {COLUMN_CONFIG.map((col) => (
              <KanbanColumn
                key={col.id}
                config={col}
                issues={columnIssues[col.id] || []}
                onIssueClick={handleIssueClick}
                onQuickAction={handleQuickAction}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={{
            duration: 200,
            easing: 'ease',
          }}>
            {activeIssue ? (
              <DragOverlayCard issue={activeIssue} />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        /* Table View */
        <div className="flex-1 overflow-auto rounded-lg border border-border/50">
          {/* Bulk Actions Bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 border-b border-primary/10">
              <span className="text-xs font-medium text-primary">
                已选择 {selectedIds.size} 项
              </span>
              <div className="flex items-center gap-2">
                <Select onValueChange={(val) => {
                  selectedIds.forEach(id => {
                    changeStatusMutation.mutate({ id, data: { status: val } })
                  })
                  setSelectedIds(new Set())
                  toast.success(`已更新 ${selectedIds.size} 项状态`)
                }}>
                  <SelectTrigger className="h-7 w-28 text-xs">
                    <SelectValue placeholder="批量改状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">待处理</SelectItem>
                    <SelectItem value="in_progress">进行中</SelectItem>
                    <SelectItem value="in_review">待审查</SelectItem>
                    <SelectItem value="resolved">已解决</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    selectedIds.forEach(id => deleteIssueMutation.mutate(id))
                    setSelectedIds(new Set())
                    toast.success(`已删除 ${selectedIds.size} 项`)
                  }}
                >
                  <Trash2 className="size-3" />
                  批量删除
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSelectedIds(new Set())}
                >
                  取消选择
                </Button>
              </div>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <UICheckbox
                    checked={selectedIds.size > 0 && selectedIds.size === filteredIssues.length}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedIds(new Set(filteredIssues.map(i => i.id)))
                      } else {
                        setSelectedIds(new Set())
                      }
                    }}
                  />
                </TableHead>
                <TableHead className="w-8" />
                <TableHead
                  className="cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => {
                    if (sortField === 'title') setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                    else { setSortField('title'); setSortDir('asc') }
                  }}
                >
                  <span className="flex items-center gap-1">
                    标题
                    <ArrowUpDown className="size-3 opacity-50" />
                  </span>
                </TableHead>
                <TableHead className="hidden md:table-cell">场景</TableHead>
                <TableHead className="hidden sm:table-cell">指派</TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => {
                    if (sortField === 'status') setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                    else { setSortField('status'); setSortDir('asc') }
                  }}
                >
                  <span className="flex items-center gap-1">
                    状态
                    <ArrowUpDown className="size-3 opacity-50" />
                  </span>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground transition-colors hidden lg:table-cell"
                  onClick={() => {
                    if (sortField === 'createdAt') setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                    else { setSortField('createdAt'); setSortDir('desc') }
                  }}
                >
                  <span className="flex items-center gap-1">
                    创建时间
                    <ArrowUpDown className="size-3 opacity-50" />
                  </span>
                </TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIssues.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    暂无匹配的任务
                  </TableCell>
                </TableRow>
              ) : (
                [...filteredIssues].sort((a, b) => {
                  const dir = sortDir === 'asc' ? 1 : -1
                  if (sortField === 'title') return dir * a.title.localeCompare(b.title)
                  if (sortField === 'status') return dir * a.status.localeCompare(b.status)
                  if (sortField === 'priority') {
                    const order = { urgent: 0, high: 1, medium: 2, low: 3 }
                    return dir * ((order[a.priority as keyof typeof order] ?? 2) - (order[b.priority as keyof typeof order] ?? 2))
                  }
                  if (sortField === 'createdAt') return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                  return 0
                }).map((issue) => {
                  const priority = PRIORITY_CONFIG[issue.priority] || PRIORITY_CONFIG.medium
                  const isSelected = selectedIds.has(issue.id)
                  return (
                    <TableRow
                      key={issue.id}
                      className={`cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
                      onClick={() => handleIssueClick(issue)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <UICheckbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            setSelectedIds(prev => {
                              const next = new Set(prev)
                              if (checked) next.add(issue.id)
                              else next.delete(issue.id)
                              return next
                            })
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <span className={`size-2.5 rounded-full block ${priority.color.replace('text-', 'bg-').replace('600', '500')}`} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium line-clamp-1">{issue.title}</span>
                          <div className="hidden sm:flex items-center gap-1">
                            <Badge variant="outline" className={`text-[9px] px-1 py-0 ${priority.bg} ${priority.color} border`}>
                              {priority.label}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {issue.scene && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {SCENE_LABELS[issue.scene] || issue.scene}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {issue.assignee ? (
                          <div className="flex items-center gap-1.5">
                            <Avatar className="size-5">
                              <AvatarFallback className={`text-[8px] ${issue.assignee.type === 'agent' ? 'bg-primary/10 text-primary' : 'bg-teal-500/10 text-teal-600'}`}>
                                {issue.assignee.type === 'agent' ? <Bot className="size-2.5" /> : issue.assignee.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">{issue.assignee.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {STATUS_LABELS[issue.status] || issue.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true, locale: zhCN })}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteIssueMutation.mutate(issue.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Issue Dialog */}
      <CreateIssueDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        agents={agents || []}
        userId={userId}
      />

      {/* Issue Detail Sheet */}
      <IssueDetailSheet
        issue={selectedIssue}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setSelectedIssue(null)
        }}
        agents={agents || []
        }
        userId={userId}
      />
    </div>
  )
}
