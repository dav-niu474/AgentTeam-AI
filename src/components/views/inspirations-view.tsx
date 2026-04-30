'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  Lightbulb,
  Sparkles,
  MessageSquare,
  Mic,
  PenLine,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  Filter,
  RefreshCw,
  Eye,
  ListTodo,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useInspirations,
  useAnalyzeInspiration,
} from '@/lib/hooks'
import { useAppStore } from '@/lib/store'
import type { Inspiration } from '@/lib/api'
import { toast } from 'sonner'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  pending: { label: '待分析', color: 'text-amber-600', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: Clock },
  analyzing: { label: '分析中', color: 'text-teal-600', bg: 'bg-teal-500/10', border: 'border-teal-500/30', icon: Loader2 },
  converted: { label: '已转化', color: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: CheckCircle2 },
  dismissed: { label: '已忽略', color: 'text-gray-500', bg: 'bg-gray-500/10', border: 'border-gray-500/30', icon: XCircle },
}

const SOURCE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  chat: { label: '聊天', icon: MessageSquare, color: 'text-teal-500' },
  voice: { label: '语音', icon: Mic, color: 'text-violet-500' },
  quick_note: { label: '快速笔记', icon: PenLine, color: 'text-amber-500' },
  im: { label: 'IM', icon: MessageSquare, color: 'text-emerald-500' },
}

// Lightbulb animation for empty state
function AnimatedLightbulb() {
  return (
    <motion.div
      animate={{
        filter: [
          'drop-shadow(0 0 4px oklch(0.75 0.15 85 / 30%))',
          'drop-shadow(0 0 16px oklch(0.75 0.15 85 / 60%)) drop-shadow(0 0 32px oklch(0.75 0.15 85 / 20%))',
          'drop-shadow(0 0 4px oklch(0.75 0.15 85 / 30%))',
        ],
        y: [0, -6, 0],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <Lightbulb className="size-14 text-amber-400" />
    </motion.div>
  )
}

function InspirationCard({
  inspiration,
  onAnalyze,
  onDismiss,
}: {
  inspiration: Inspiration
  onAnalyze: (id: string) => void
  onDismiss: (id: string) => void
}) {
  const statusConfig = STATUS_CONFIG[inspiration.status] || STATUS_CONFIG.pending
  const sourceConfig = SOURCE_CONFIG[inspiration.source] || SOURCE_CONFIG.quick_note
  const StatusIcon = statusConfig.icon
  const SourceIcon = sourceConfig.icon
  const convertedIssues = inspiration.issues || []

  return (
    <motion.div variants={item}>
      <Card className={`hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 group card-flowing-gradient overflow-hidden border-l-[3px] ${statusConfig.border}`}>
        <CardContent className="p-4 space-y-3 relative">
          {/* Header row */}
          <div className="flex items-start gap-3">
            <motion.div
              className={`flex size-9 items-center justify-center rounded-lg shrink-0 ${statusConfig.bg} border ${statusConfig.border}`}
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.15 }}
            >
              <StatusIcon className={`size-4 ${statusConfig.color} ${inspiration.status === 'analyzing' ? 'animate-spin' : ''}`} />
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{inspiration.content}</p>
              <div className="flex items-center gap-2 mt-2">
                {/* Source badge */}
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 rounded-full">
                  <SourceIcon className={`size-3 ${sourceConfig.color}`} />
                  {sourceConfig.label}
                </Badge>
                {/* Status badge */}
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusConfig.bg} ${statusConfig.color} border ${statusConfig.border} rounded-full`}>
                  {statusConfig.label}
                </Badge>
                {/* Time */}
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(inspiration.createdAt), { addSuffix: true, locale: zhCN })}
                </span>
              </div>
            </div>
          </div>

          {/* Converted Issues */}
          {convertedIssues.length > 0 && (
            <div className="space-y-1.5 pl-12">
              <p className="text-xs font-medium text-muted-foreground">转化任务:</p>
              {convertedIssues.map((issue) => (
                <div key={issue.id} className="flex items-center gap-2 text-xs">
                  <ListTodo className="size-3 text-muted-foreground" />
                  <span className="truncate flex-1">{issue.title}</span>
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1 py-0 shrink-0 rounded-full ${
                      issue.status === 'resolved' ? 'border-emerald-500/30 text-emerald-600' :
                      issue.status === 'in_progress' ? 'border-teal-500/30 text-teal-600' :
                      'border-gray-400/30 text-gray-500'
                    }`}
                  >
                    {issue.status === 'open' ? '待处理' : issue.status === 'in_progress' ? '进行中' : issue.status === 'resolved' ? '已解决' : issue.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pl-12">
            {(inspiration.status === 'pending' || inspiration.status === 'analyzing') && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1 h-7 hover:text-primary"
                onClick={() => onAnalyze(inspiration.id)}
                disabled={inspiration.status === 'analyzing'}
              >
                {inspiration.status === 'analyzing' ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RefreshCw className="size-3" />
                )}
                {inspiration.status === 'analyzing' ? '分析中...' : '重新分析'}
              </Button>
            )}
            {inspiration.status !== 'dismissed' && inspiration.status !== 'converted' && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1 h-7 text-muted-foreground hover:text-destructive"
                onClick={() => onDismiss(inspiration.id)}
              >
                <XCircle className="size-3" />
                忽略
              </Button>
            )}
            {inspiration.status === 'converted' && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1 h-7 hover:text-primary"
                onClick={() => useAppStore.getState().setActiveView('board')}
              >
                <Eye className="size-3" />
                查看任务
                <ChevronRight className="size-3" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function InspirationsView() {
  const { setShowInspirationInput } = useAppStore()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const { data: inspirations, isLoading } = useInspirations()
  const analyzeMutation = useAnalyzeInspiration()

  const filteredInspirations = useMemo(() => {
    if (!inspirations) return []
    if (statusFilter === 'all') return inspirations
    return inspirations.filter((i) => i.status === statusFilter)
  }, [inspirations, statusFilter])

  // Sort by date, newest first
  const sortedInspirations = useMemo(() => {
    return [...filteredInspirations].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [filteredInspirations])

  // Stats
  const stats = useMemo(() => {
    if (!inspirations) return { total: 0, pending: 0, analyzing: 0, converted: 0, dismissed: 0 }
    return {
      total: inspirations.length,
      pending: inspirations.filter((i) => i.status === 'pending').length,
      analyzing: inspirations.filter((i) => i.status === 'analyzing').length,
      converted: inspirations.filter((i) => i.status === 'converted').length,
      dismissed: inspirations.filter((i) => i.status === 'dismissed').length,
    }
  }, [inspirations])

  const handleAnalyze = (id: string) => {
    analyzeMutation.mutate(id, {
      onSuccess: () => {
        toast.success('灵感分析已触发')
      },
      onError: () => {
        toast.error('分析失败，请稍后重试')
      },
    })
  }

  const handleDismiss = (id: string) => {
    // Use the inspirations update API to set status to dismissed
    fetch(`/api/inspirations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'dismissed' }),
    }).then(() => {
      toast.success('已忽略')
    }).catch(() => {
      toast.error('操作失败')
    })
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 p-4 md:p-6"
    >
      {/* Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Lightbulb className="size-6 text-primary" />
            Inspirations
          </h1>
          <p className="text-muted-foreground mt-1">灵感记录与追踪 - 从想法到任务</p>
        </div>
        <Button className="gap-2 hover:-translate-y-0.5 transition-all shadow-sm hover:shadow-md" onClick={() => setShowInspirationInput(true)}>
          <Sparkles className="size-4" />
          表达想法
        </Button>
      </motion.div>

      {/* Stats */}
      <motion.div variants={item}>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-amber-300 dark:hover:border-amber-600 overflow-hidden">
            <CardContent className="pt-4 pb-3 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent" />
              <div className="flex items-center gap-2 relative">
                <div className="flex size-8 items-center justify-center rounded-md bg-amber-500/10">
                  <Clock className="size-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-lg font-bold">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">待分析</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 dark:hover:border-teal-600 overflow-hidden">
            <CardContent className="pt-4 pb-3 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent" />
              <div className="flex items-center gap-2 relative">
                <div className="flex size-8 items-center justify-center rounded-md bg-teal-500/10">
                  <Loader2 className="size-4 text-teal-600" />
                </div>
                <div>
                  <p className="text-lg font-bold">{stats.analyzing}</p>
                  <p className="text-xs text-muted-foreground">分析中</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300 dark:hover:border-emerald-600 overflow-hidden">
            <CardContent className="pt-4 pb-3 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
              <div className="flex items-center gap-2 relative">
                <div className="flex size-8 items-center justify-center rounded-md bg-emerald-500/10">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-lg font-bold">{stats.converted}</p>
                  <p className="text-xs text-muted-foreground">已转化</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-md bg-gray-500/10">
                  <XCircle className="size-4 text-gray-500" />
                </div>
                <div>
                  <p className="text-lg font-bold">{stats.dismissed}</p>
                  <p className="text-xs text-muted-foreground">已忽略</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Filter */}
      <motion.div variants={item} className="flex items-center gap-2">
        <Filter className="size-4 text-muted-foreground" />
        <div className="transition-all duration-300 ease-in-out">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部 ({stats.total})</SelectItem>
            <SelectItem value="pending">待分析 ({stats.pending})</SelectItem>
            <SelectItem value="analyzing">分析中 ({stats.analyzing})</SelectItem>
            <SelectItem value="converted">已转化 ({stats.converted})</SelectItem>
            <SelectItem value="dismissed">已忽略 ({stats.dismissed})</SelectItem>
          </SelectContent>
        </Select>
        </div>
      </motion.div>

      {/* Timeline */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="size-9 rounded-lg shimmer" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sortedInspirations.length > 0 ? (
        <div className="space-y-3">
          {sortedInspirations.map((insp) => (
            <InspirationCard
              key={insp.id}
              inspiration={insp}
              onAnalyze={handleAnalyze}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      ) : (
        <motion.div variants={item}>
          <Card className="overflow-hidden">
            <CardContent className="py-16 flex flex-col items-center justify-center text-muted-foreground">
              <AnimatedLightbulb />
              <p className="text-lg font-medium mt-6">暂无灵感记录</p>
              <p className="text-sm mt-1 mb-4">表达你的想法，让 Agent 帮你分析和拆解</p>
              <Button
                variant="outline"
                className="gap-2 hover:-translate-y-0.5 transition-all shadow-sm hover:shadow-md hover:border-primary/30"
                onClick={() => setShowInspirationInput(true)}
              >
                <Sparkles className="size-4 text-primary" />
                表达想法
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  )
}
