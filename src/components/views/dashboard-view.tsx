'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  LayoutDashboard,
  ListTodo,
  Clock,
  Bot,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Activity,
  User,
  MessageSquare,
  GitBranch,
  AlertCircle,
  Lightbulb,
  TrendingUp,
  Users,
  Zap,
  ChevronRight,
  PlusCircle,
  Sun,
  Moon,
  CloudSun,
  Radar,
  ScanSearch,
  Eye,
  ListChecks,
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useStats, useAgents, useAuditLogs, useInspirations } from '@/lib/hooks'
import { parseJsonField } from '@/lib/api'
import type { AuditLog } from '@/lib/api'

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

const STATUS_LABELS: Record<string, string> = {
  open: '待处理',
  triaged: '已分诊',
  in_progress: '进行中',
  in_review: '待审查',
  resolved: '已解决',
  closed: '已关闭',
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  create_issue: ListTodo,
  create_issue_from_inspiration: Sparkles,
  change_status: GitBranch,
  reassign_issue: User,
  add_comment: MessageSquare,
  analyze_inspiration: Lightbulb,
  delete_issue: AlertCircle,
}

const ACTION_COLORS: Record<string, string> = {
  create_issue: 'text-blue-500',
  create_issue_from_inspiration: 'text-primary',
  change_status: 'text-amber-500',
  reassign_issue: 'text-purple-500',
  add_comment: 'text-emerald-500',
  analyze_inspiration: 'text-primary',
  delete_issue: 'text-destructive',
}

const ACTION_BORDER_COLORS: Record<string, string> = {
  create_issue: 'border-l-blue-500',
  create_issue_from_inspiration: 'border-l-primary',
  change_status: 'border-l-amber-500',
  reassign_issue: 'border-l-purple-500',
  add_comment: 'border-l-emerald-500',
  analyze_inspiration: 'border-l-primary',
  delete_issue: 'border-l-destructive',
}

const PIE_COLORS = ['#94a3b8', '#6ee7b7', '#fbbf24', '#34d399', '#10b981', '#6b7280']

function formatActionLabel(action: string, details: string | null): string {
  const parsed = details ? parseJsonField<Record<string, unknown>>(details, {}) : {}
  switch (action) {
    case 'create_issue':
      return `创建了 Issue${parsed.title ? `: ${parsed.title}` : ''}`
    case 'create_issue_from_inspiration':
      return `从灵感创建了 Issue${parsed.title ? `: ${parsed.title}` : ''}`
    case 'change_status':
      return `状态变更: ${STATUS_LABELS[String(parsed.from)] || parsed.from} → ${STATUS_LABELS[String(parsed.to)] || parsed.to}`
    case 'reassign_issue':
      return '重新指派了 Issue'
    case 'add_comment':
      return '添加了评论'
    case 'analyze_inspiration':
      return `分析了灵感，生成了 ${parsed.issuesCreated || ''} 个任务`
    case 'delete_issue':
      return `删除了 Issue${parsed.title ? `: ${parsed.title}` : ''}`
    default:
      return action
  }
}

// ============ useCountUp Hook ============

function useCountUp(end: number, duration = 800) {
  const [count, setCount] = useState(end)
  const prevEnd = useRef(end)

  useEffect(() => {
    if (prevEnd.current === end) return
    const startVal = prevEnd.current
    prevEnd.current = end

    const startTime = Date.now()
    const step = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(startVal + (end - startVal) * eased))
      if (progress < 1) {
        requestAnimationFrame(step)
      }
    }
    requestAnimationFrame(step)
  }, [end, duration])

  return count
}

// ============ Sparkline Component ============

function Sparkline({ data, color = '#10b981', width = 80, height = 28 }: { data: number[]; color?: string; width?: number; height?: number }) {
  if (data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const padding = 2

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding)
    const y = height - padding - ((v - min) / range) * (height - 2 * padding)
    return `${x},${y}`
  }).join(' ')

  const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`

  return (
    <svg width={width} height={height} className="opacity-60">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={areaPoints}
        fill={`url(#grad-${color.replace('#', '')})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ============ Progress Ring Component ============

function ProgressRing({ value, size = 48, strokeWidth = 4 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (value / 100) * circumference

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/50"
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="url(#progress-gradient)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
      <defs>
        <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ============ Time Greeting ============

function useTimeGreeting() {
  const hour = new Date().getHours()
  if (hour < 6) {
    return { text: '夜深了', icon: Moon }
  } else if (hour < 12) {
    return { text: '早上好', icon: Sun }
  } else if (hour < 18) {
    return { text: '下午好', icon: CloudSun }
  } else {
    return { text: '晚上好', icon: Moon }
  }
}

// ============ Animated Stat Card ============

const STAT_GRADIENTS = [
  'from-slate-500/10 via-slate-500/5 to-transparent',
  'from-emerald-500/10 via-emerald-500/5 to-transparent',
  'from-purple-500/10 via-purple-500/5 to-transparent',
  'from-green-500/10 via-green-500/5 to-transparent',
  'from-teal-500/10 via-teal-500/5 to-transparent',
]

const STAT_BORDERS = [
  'hover:border-slate-300 dark:hover:border-slate-600',
  'hover:border-emerald-300 dark:hover:border-emerald-600',
  'hover:border-purple-300 dark:hover:border-purple-600',
  'hover:border-green-300 dark:hover:border-green-600',
  'hover:border-teal-300 dark:hover:border-teal-600',
]

function AnimatedStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  sparkData,
  sparkColor,
  gradientIndex = 0,
  progressRing,
}: {
  title: string
  value: number
  subtitle: React.ReactNode
  icon: React.ElementType
  iconColor?: string
  sparkData?: number[]
  sparkColor?: string
  gradientIndex?: number
  progressRing?: number
}) {
  const animatedValue = useCountUp(value)
  const gradient = STAT_GRADIENTS[gradientIndex % STAT_GRADIENTS.length]
  const borderHover = STAT_BORDERS[gradientIndex % STAT_BORDERS.length]

  return (
    <Card className={`hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group relative overflow-hidden ${borderHover}`}>
      {/* Gradient background - always visible subtly, stronger on hover */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} group-hover:opacity-100 opacity-60 transition-opacity duration-500`} />
      <div className="relative">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <div className={`flex size-7 items-center justify-center rounded-md ${iconColor ? `${iconColor.replace('text-', 'bg-').replace('500', '500/10')}` : 'bg-muted'}`}>
            <Icon className={`size-3.5 ${iconColor || 'text-muted-foreground'} transition-transform group-hover:scale-110`} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-2xl font-bold tabular-nums">{animatedValue}{progressRing !== undefined ? '%' : ''}</div>
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            </div>
            {progressRing !== undefined && (
              <div className="relative">
                <ProgressRing value={progressRing} />
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                  {progressRing}
                </span>
              </div>
            )}
            {sparkData && sparkData.length > 1 && !progressRing && progressRing === undefined && (
              <Sparkline data={sparkData} color={sparkColor || '#10b981'} />
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  )
}

function StatsCardSkeleton() {
  return (
    <Card className="shimmer">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="size-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-12 mb-1" />
        <Skeleton className="h-3 w-16" />
      </CardContent>
    </Card>
  )
}

// ============ Pipeline Stage ============

function PipelineStage({ label, count, color, isLast, icon: Icon }: { label: string; count: number; color: string; isLast?: boolean; icon?: React.ElementType }) {
  return (
    <div className="flex items-center gap-0">
      <motion.div
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border ${color} min-w-[100px] justify-center`}
        whileHover={{ scale: 1.02, y: -1 }}
        transition={{ duration: 0.15 }}
      >
        {Icon && <Icon className="size-3.5 opacity-60" />}
        <span className="text-sm font-medium">{label}</span>
        <Badge variant="secondary" className="text-xs h-5 min-w-[20px] justify-center font-bold">
          {count}
        </Badge>
      </motion.div>
      {!isLast && (
        <motion.div
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
        >
          <ChevronRight className="size-5 text-muted-foreground/50 mx-0.5 shrink-0" />
        </motion.div>
      )}
    </div>
  )
}

// ============ Activity Group ============

interface ActivityGroup {
  label: string
  logs: AuditLog[]
}

function groupActivitiesByDate(logs: AuditLog[]): ActivityGroup[] {
  const groups: ActivityGroup[] = []
  const todayLogs: AuditLog[] = []
  const yesterdayLogs: AuditLog[] = []
  const olderLogs: AuditLog[] = []

  for (const log of logs) {
    const date = new Date(log.createdAt)
    if (isToday(date)) {
      todayLogs.push(log)
    } else if (isYesterday(date)) {
      yesterdayLogs.push(log)
    } else {
      olderLogs.push(log)
    }
  }

  if (todayLogs.length > 0) groups.push({ label: '今天', logs: todayLogs })
  if (yesterdayLogs.length > 0) groups.push({ label: '昨天', logs: yesterdayLogs })
  if (olderLogs.length > 0) groups.push({ label: '更早', logs: olderLogs })

  return groups
}

// ============ Main Dashboard View ============

export function DashboardView() {
  const { setActiveView, setShowInspirationInput } = useAppStore()
  const { data: stats, isLoading: statsLoading } = useStats()
  const { data: agents } = useAgents()
  const { data: auditData } = useAuditLogs({ limit: 15 })
  const { data: inspirations } = useInspirations()
  const queryClient = useQueryClient()
  const [seeding, setSeeding] = useState(false)
  const [scanResult, setScanResult] = useState<{
    scanBy: { name: string }
    createdIssues: { id: string; title: string; priority: string }[]
    scanSummary?: string
    recommendations: string[]
  } | null>(null)
  const [agentScanning, setAgentScanning] = useState(false)
  const greeting = useTimeGreeting()
  const GreetingIcon = greeting.icon

  const handleAgentScan = async () => {
    setAgentScanning(true)
    try {
      const res = await fetch('/api/agents/scan', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Scan failed' }))
        throw new Error(err.error || 'Scan failed')
      }
      const result = await res.json()
      await queryClient.invalidateQueries()
      setScanResult({
        scanBy: { name: result.scanBy?.name || 'Agent' },
        createdIssues: (result.createdIssues || []).map((i: { id: string; title: string; priority: string }) => ({ id: i.id, title: i.title, priority: i.priority })),
        scanSummary: result.scanSummary || '扫描完成',
        recommendations: result.recommendations || [],
      })
      if ((result.createdIssues || []).length > 0) {
        toast.success(`${result.scanBy?.name || 'Agent'} 扫描完成，创建了 ${(result.createdIssues || []).length} 个新任务！`)
      } else {
        toast.success(`${result.scanBy?.name || 'Agent'} 扫描完成，未发现需要新建的任务`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Agent 扫描失败')
    } finally {
      setAgentScanning(false)
    }
  }

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      if (!res.ok) throw new Error('Seed failed')
      await queryClient.invalidateQueries()
      toast.success('示例数据创建成功！')
    } catch {
      toast.error('创建示例数据失败，请重试')
    } finally {
      setSeeding(false)
    }
  }

  // Generate pseudo-random sparkline data for MVP
  const sparkDataTotal = useMemo(() => [3, 5, 4, 7, 6, 8, stats?.issues.total || 0], [stats?.issues.total])
  const sparkDataProgress = useMemo(() => [1, 2, 3, 2, 4, 3, stats?.issues.byStatus.in_progress || 0], [stats?.issues.byStatus.in_progress])
  const sparkDataAgents = useMemo(() => [2, 3, 2, 4, 3, 4, stats?.agents.total || 0], [stats?.agents.total])
  const sparkDataRate = useMemo(() => {
    const rate = stats ? Math.round((((stats.issues.byStatus.resolved || 0) + (stats.issues.byStatus.closed || 0)) / Math.max(stats.issues.total, 1)) * 100) : 0
    return [20, 35, 40, 50, 45, 55, rate]
  }, [stats])
  const sparkDataInsp = useMemo(() => [2, 3, 5, 4, 3, 2, stats?.inspirations.byStatus.pending || 0], [stats?.inspirations.byStatus.pending])

  const pieData = useMemo(() => {
    if (!stats) return []
    const { byStatus } = stats.issues
    return [
      { name: '待处理', value: byStatus.open || 0, status: 'open' },
      { name: '已分诊', value: byStatus.triaged || 0, status: 'triaged' },
      { name: '进行中', value: byStatus.in_progress || 0, status: 'in_progress' },
      { name: '待审查', value: byStatus.in_review || 0, status: 'in_review' },
      { name: '已解决', value: byStatus.resolved || 0, status: 'resolved' },
      { name: '已关闭', value: byStatus.closed || 0, status: 'closed' },
    ].filter((d) => d.value > 0)
  }, [stats])

  const completionRate = useMemo(() => {
    if (!stats || stats.issues.total === 0) return 0
    return Math.round(
      (((stats.issues.byStatus.resolved || 0) + (stats.issues.byStatus.closed || 0)) / stats.issues.total) * 100
    )
  }, [stats])

  const recentLogs: AuditLog[] = auditData?.data || []
  const activityGroups = useMemo(() => groupActivitiesByDate(recentLogs), [recentLogs])

  const pipelineData = useMemo(() => {
    if (!inspirations) return { pending: 0, analyzing: 0, converted: 0 }
    return {
      pending: inspirations.filter(i => i.status === 'pending').length,
      analyzing: inspirations.filter(i => i.status === 'analyzing').length,
      converted: inspirations.filter(i => i.status === 'converted').length,
    }
  }, [inspirations])

  const hasNoAgents = !agents || agents.length === 0
  const hasNoIssues = !stats || stats.issues.total === 0

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 p-4 md:p-6 bg-pattern-dots min-h-full"
    >
      {/* Header with greeting */}
      <motion.div variants={item}>
        <div className="flex items-center gap-2">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5"
          >
            <GreetingIcon className="size-5 text-primary" />
          </motion.div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="gradient-text">{greeting.text}</span>！
            </h1>
            <p className="text-muted-foreground mt-0.5">
              这里是你的工作总览
            </p>
          </div>
        </div>
      </motion.div>

      {/* Empty State CTA - Show when no agents exist */}
      {hasNoAgents && !statsLoading && (
        <motion.div variants={item}>
          <Card className="border-primary/30 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 overflow-hidden card-flowing-gradient">
            <CardContent className="pt-6 pb-6 relative">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 shrink-0 glow-emerald">
                  <Users className="size-8 text-primary" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-lg font-semibold">还没有 Agent 团队成员</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    创建 AI Agent 团队，开始协作开发。一键即可创建默认团队和示例数据。
                  </p>
                </div>
                <Button
                  className="gap-2 shrink-0 shadow-md hover:shadow-lg transition-shadow"
                  onClick={handleSeed}
                  disabled={seeding}
                >
                  <Zap className="size-4" />
                  {seeding ? '创建中...' : '一键创建默认团队'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        {statsLoading ? (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : (
          <>
            <motion.div variants={item}>
              <AnimatedStatCard
                title="全部任务"
                value={stats?.issues.total || 0}
                subtitle={
                  stats?.issues.total
                    ? `${stats.issues.byStatus.open || 0} 个待处理`
                    : '暂无任务'
                }
                icon={ListTodo}
                iconColor="text-slate-500"
                sparkData={sparkDataTotal}
                sparkColor="#94a3b8"
                gradientIndex={0}
              />
            </motion.div>

            <motion.div variants={item}>
              <AnimatedStatCard
                title="进行中"
                value={stats?.issues.byStatus.in_progress || 0}
                subtitle={
                  stats?.issues.byStatus.in_review
                    ? `${stats.issues.byStatus.in_review} 个待审查`
                    : '暂无进行中的任务'
                }
                icon={Clock}
                iconColor="text-emerald-500"
                sparkData={sparkDataProgress}
                sparkColor="#10b981"
                gradientIndex={1}
              />
            </motion.div>

            <motion.div variants={item}>
              <AnimatedStatCard
                title="Agent 状态"
                value={stats?.agents.total || 0}
                subtitle={
                  stats?.agents.total ? (
                    <span className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {stats.agents.byStatus.online}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-amber-500" />
                        {stats.agents.byStatus.busy}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-gray-400" />
                        {stats.agents.byStatus.offline}
                      </span>
                    </span>
                  ) : '暂无 Agent'
                }
                icon={Bot}
                iconColor="text-purple-500"
                sparkData={sparkDataAgents}
                sparkColor="#8b5cf6"
                gradientIndex={2}
              />
            </motion.div>

            <motion.div variants={item}>
              <AnimatedStatCard
                title="完成率"
                value={completionRate}
                subtitle={
                  stats?.issues.total ? `共 ${stats.issues.total} 个任务` : '暂无任务'
                }
                icon={CheckCircle2}
                iconColor="text-green-500"
                sparkData={sparkDataRate}
                sparkColor="#22c55e"
                gradientIndex={3}
                progressRing={completionRate}
              />
            </motion.div>

            <motion.div variants={item}>
              <AnimatedStatCard
                title="待处理灵感"
                value={stats?.inspirations.byStatus.pending || 0}
                subtitle={
                  stats?.inspirations.byStatus.analyzing
                    ? `${stats.inspirations.byStatus.analyzing} 个分析中`
                    : '等待你的灵感'
                }
                icon={Sparkles}
                iconColor="text-primary"
                sparkData={sparkDataInsp}
                sparkColor="#10b981"
                gradientIndex={4}
              />
            </motion.div>
          </>
        )}
      </div>

      {/* Inspiration Pipeline */}
      <motion.div variants={item}>
        <Card className="overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              灵感管线
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-0 flex-wrap py-2">
              <PipelineStage
                label="灵感"
                count={pipelineData.pending}
                color="border-amber-500/30 bg-amber-500/5"
                icon={Lightbulb}
              />
              <PipelineStage
                label="分析中"
                count={pipelineData.analyzing}
                color="border-teal-500/30 bg-teal-500/5"
                icon={Activity}
              />
              <PipelineStage
                label="已转化"
                count={pipelineData.converted}
                color="border-emerald-500/30 bg-emerald-500/5"
                icon={CheckCircle2}
                isLast
              />
            </div>
            {(pipelineData.pending + pipelineData.analyzing + pipelineData.converted) === 0 && (
              <div className="text-center py-4">
                <Lightbulb className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">暂无灵感数据</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-primary mt-2"
                  onClick={() => setShowInspirationInput(true)}
                >
                  表达想法
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Content: Chart + Agents + Activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Status Distribution Chart */}
        <motion.div variants={item}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">任务状态分布</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <div className="w-40 h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={60}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                        >
                          {pieData.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid hsl(var(--border))',
                            background: 'hsl(var(--popover))',
                            color: 'hsl(var(--popover-foreground))',
                            fontSize: '12px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col gap-2 text-sm">
                    {pieData.map((d, i) => (
                      <div key={d.status} className="flex items-center gap-2">
                        <span
                          className="size-3 rounded-sm shrink-0"
                          style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        <span className="text-muted-foreground">{d.name}</span>
                        <span className="font-medium ml-auto">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground">
                  <div className="text-center">
                    <ListTodo className="size-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">暂无任务数据</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Agent Status Section */}
        <motion.div variants={item}>
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Agent 团队</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1"
                onClick={() => setActiveView('agents')}
              >
                查看全部 <ArrowRight className="size-3" />
              </Button>
            </CardHeader>
            <CardContent>
              {agents && agents.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {agents.slice(0, 6).map((agent, idx) => (
                    <motion.div
                      key={agent.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-all duration-200 hover:translate-x-0.5"
                    >
                      <Avatar className="size-8 ring-1 ring-border/30">
                        <AvatarImage src={agent.avatar || undefined} alt={agent.name} />
                        <AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
                          {agent.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{agent.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {parseJsonField<string[]>(agent.capabilities, []).join(', ') || '无能力标签'}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${
                          agent.agentStatus === 'online'
                            ? 'border-emerald-500/50 text-emerald-600'
                            : agent.agentStatus === 'busy'
                              ? 'border-amber-500/50 text-amber-600'
                              : 'border-gray-400/50 text-gray-500'
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full mr-1 ${
                            agent.agentStatus === 'online'
                              ? 'bg-emerald-500 animate-pulse'
                              : agent.agentStatus === 'busy'
                                ? 'bg-amber-500'
                                : 'bg-gray-400'
                          }`}
                        />
                        {agent.agentStatus === 'online' ? '在线' : agent.agentStatus === 'busy' ? '忙碌' : '离线'}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <div className="text-center space-y-3">
                    <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Bot className="size-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">还没有 Agent 团队成员</p>
                      <p className="text-xs mt-1">创建 AI Agent 团队，开始协作开发</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={handleSeed}
                      disabled={seeding}
                    >
                      <PlusCircle className="size-4" />
                      {seeding ? '创建中...' : '一键创建默认团队'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activity Timeline */}
        <motion.div variants={item}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="size-5 text-primary" />
                最近活动
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activityGroups.length > 0 ? (
                <div className="space-y-4 max-h-72 overflow-y-auto">
                  {activityGroups.map((group) => (
                    <div key={group.label}>
                      <p className="text-xs font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-1">
                        {group.label}
                      </p>
                      <div className="space-y-1">
                        {group.logs.map((log) => {
                          const Icon = ACTION_ICONS[log.action] || Activity
                          const colorClass = ACTION_COLORS[log.action] || 'text-muted-foreground'
                          const borderColor = ACTION_BORDER_COLORS[log.action] || 'border-l-muted-foreground'
                          return (
                            <div
                              key={log.id}
                              className={`flex items-start gap-3 py-1.5 px-2 rounded-md border-l-2 ${borderColor} hover:bg-muted/30 transition-colors`}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-xs">
                                  <span className="font-medium">{log.actor?.name || 'System'}</span>
                                  <span className="text-muted-foreground"> {formatActionLabel(log.action, log.details)}</span>
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: zhCN })}
                                </p>
                              </div>
                              <Icon className={`size-3.5 shrink-0 mt-0.5 ${colorClass}`} />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground">
                  <div className="text-center">
                    <Clock className="size-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">暂无活动记录</p>
                    <p className="text-xs mt-1">开始使用后，这里会显示最近的活动</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">快速操作</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Button
              variant="outline"
              className="justify-start gap-2 h-auto py-3 hover:-translate-y-0.5 transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
              onClick={() => setShowInspirationInput(true)}
            >
              <Sparkles className="size-4 text-primary" />
              <span>表达想法</span>
              <ArrowRight className="size-3 ml-auto" />
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-2 h-auto py-3 hover:-translate-y-0.5 transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
              onClick={() => setActiveView('board')}
            >
              <ListTodo className="size-4" />
              <span>新建 Issue</span>
              <ArrowRight className="size-3 ml-auto" />
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-2 h-auto py-3 hover:-translate-y-0.5 transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
              onClick={() => setActiveView('agents')}
            >
              <Bot className="size-4" />
              <span>查看 Agent</span>
              <ArrowRight className="size-3 ml-auto" />
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-2 h-auto py-3 hover:-translate-y-0.5 transition-all hover:border-orange-500/30 hover:bg-orange-500/5 hover:text-orange-600"
              onClick={handleAgentScan}
              disabled={agentScanning}
            >
              <Radar className={`size-4 ${agentScanning ? 'animate-spin' : 'text-orange-500'}`} />
              <span>{agentScanning ? '扫描中...' : '触发 Agent 扫描'}</span>
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Agent Activity Feed */}
      <motion.div variants={item}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Radar className="size-5 text-orange-500" />
              Agent 活动
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1.5"
              onClick={handleAgentScan}
              disabled={agentScanning}
            >
              <ScanSearch className={`size-3.5 ${agentScanning ? 'animate-spin' : ''}`} />
              {agentScanning ? '扫描中...' : '触发扫描'}
            </Button>
          </CardHeader>
          <CardContent>
            {/* Scan Result */}
            {scanResult && (
              <div className="mb-4 rounded-lg border border-orange-500/20 bg-orange-500/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Bot className="size-4 text-orange-500" />
                  <span>{scanResult.scanBy.name} 完成扫描</span>
                  <Badge variant="outline" className="text-[10px] h-5 ml-auto">
                    创建了 {scanResult.createdIssues.length} 个任务
                  </Badge>
                </div>
                {scanResult.scanSummary && (
                  <p className="text-xs text-muted-foreground">{scanResult.scanSummary}</p>
                )}
                {scanResult.createdIssues.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {scanResult.createdIssues.map((issue) => (
                      <div key={issue.id} className="flex items-center gap-2 text-xs rounded-md bg-background/80 px-2 py-1.5">
                        <ListChecks className="size-3 text-orange-500" />
                        <span className="font-medium truncate">{issue.title}</span>
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-auto">
                          {issue.priority}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
                {scanResult.recommendations.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">建议</p>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {scanResult.recommendations.slice(0, 3).map((rec, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <span className="text-orange-500 shrink-0">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Agent-driven activity log */}
            {(() => {
              const agentLogs = recentLogs.filter(l => l.actorType === 'agent')
              if (agentLogs.length === 0) {
                return (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <div className="text-center">
                      <Radar className="size-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">暂无 Agent 活动记录</p>
                      <p className="text-xs mt-1">Agent 分析灵感或扫描项目时，活动会显示在这里</p>
                    </div>
                  </div>
                )
              }
              return (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {agentLogs.map((log) => {
                    const Icon = ACTION_ICONS[log.action] || Radar
                    const colorClass = ACTION_COLORS[log.action] || 'text-muted-foreground'
                    const borderColor = ACTION_BORDER_COLORS[log.action] || 'border-l-muted-foreground'
                    return (
                      <div
                        key={log.id}
                        className={`flex items-start gap-3 py-1.5 px-2 rounded-md border-l-2 ${borderColor} hover:bg-muted/30 transition-colors`}
                      >
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="size-1.5 rounded-full bg-orange-500" />
                          <Bot className="size-3 text-orange-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs">
                            <span className="font-medium text-orange-600 dark:text-orange-400">{log.actor?.name || 'Agent'}</span>
                            <span className="text-muted-foreground"> {formatActionLabel(log.action, log.details)}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: zhCN })}
                          </p>
                        </div>
                        <Icon className={`size-3.5 shrink-0 mt-0.5 ${colorClass}`} />
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </CardContent>
        </Card>
      </motion.div>

      {/* System Status */}
      <motion.div variants={item}>
        <Card className="bg-gradient-to-r from-muted/30 to-transparent">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`size-4 ${(stats?.daemons.online || 0) > 0 ? 'text-emerald-500' : 'text-gray-400'}`} />
                <span>Daemon: {(stats?.daemons.online || 0) > 0 ? `${stats.daemons.online} 在线` : '离线'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className={`size-4 ${(stats?.sessions.active || 0) > 0 ? 'text-emerald-500' : 'text-gray-400'}`} />
                <span>活跃会话: {stats?.sessions.active || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="size-4 text-gray-400" />
                <span>团队成员: {(stats?.humans.total || 0) + (stats?.agents.total || 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
