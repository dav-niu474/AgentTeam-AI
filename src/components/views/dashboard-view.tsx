'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
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
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/lib/store'
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

function StatsCardSkeleton() {
  return (
    <Card className="hover:shadow-md transition-shadow">
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

export function DashboardView() {
  const { setActiveView, setShowInspirationInput } = useAppStore()
  const { data: stats, isLoading: statsLoading } = useStats()
  const { data: agents } = useAgents()
  const { data: auditData } = useAuditLogs({ limit: 10 })
  const { data: inspirations } = useInspirations({ status: 'pending' })

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

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 p-4 md:p-6"
    >
      {/* Header */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <LayoutDashboard className="size-6 text-primary" />
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          欢迎回来！这里是你的工作总览
        </p>
      </motion.div>

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
            {/* Total Issues */}
            <motion.div variants={item}>
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">全部任务</CardTitle>
                  <ListTodo className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.issues.total || 0}</div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="size-3" />
                    {stats?.issues.total ? `${stats.issues.byStatus.open || 0} 个待处理` : '暂无任务'}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* In Progress */}
            <motion.div variants={item}>
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">进行中</CardTitle>
                  <Clock className="size-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.issues.byStatus.in_progress || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.issues.byStatus.in_review ? `${stats.issues.byStatus.in_review} 个待审查` : '暂无进行中的任务'}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Agent Status */}
            <motion.div variants={item}>
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Agent 状态</CardTitle>
                  <Bot className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.agents.total || 0}</div>
                  <div className="flex items-center gap-2 mt-1">
                    {stats?.agents.total ? (
                      <>
                        <span className="flex items-center gap-1 text-xs">
                          <span className="size-2 rounded-full bg-emerald-500" />
                          {stats.agents.byStatus.online}
                        </span>
                        <span className="flex items-center gap-1 text-xs">
                          <span className="size-2 rounded-full bg-amber-500" />
                          {stats.agents.byStatus.busy}
                        </span>
                        <span className="flex items-center gap-1 text-xs">
                          <span className="size-2 rounded-full bg-gray-400" />
                          {stats.agents.byStatus.offline}
                        </span>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">暂无 Agent</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Completion Rate */}
            <motion.div variants={item}>
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">完成率</CardTitle>
                  <Badge variant="secondary" className="text-xs">{completionRate}%</Badge>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats ? (stats.issues.byStatus.resolved || 0) + (stats.issues.byStatus.closed || 0) : 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.issues.total ? `共 ${stats.issues.total} 个任务` : '暂无任务'}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Pending Inspirations */}
            <motion.div variants={item}>
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">待处理灵感</CardTitle>
                  <Sparkles className="size-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.inspirations.byStatus.pending || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.inspirations.byStatus.analyzing ? `${stats.inspirations.byStatus.analyzing} 个分析中` : '等待你的灵感'}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </div>

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
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {agents.slice(0, 6).map((agent) => (
                    <div key={agent.id} className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarImage src={agent.avatar || undefined} alt={agent.name} />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
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
                              ? 'bg-emerald-500'
                              : agent.agentStatus === 'busy'
                                ? 'bg-amber-500'
                                : 'bg-gray-400'
                          }`}
                        />
                        {agent.agentStatus === 'online' ? '在线' : agent.agentStatus === 'busy' ? '忙碌' : '离线'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground">
                  <div className="text-center">
                    <Bot className="size-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">暂无 Agent</p>
                    <p className="text-xs mt-1">前往 Agents 页面添加</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Inspiration Pipeline */}
        <motion.div variants={item}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">灵感管线</CardTitle>
            </CardHeader>
            <CardContent>
              {inspirations && inspirations.length > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {inspirations.slice(0, 5).map((insp) => (
                    <div key={insp.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                      <Sparkles className="size-4 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{insp.content}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(insp.createdAt), { addSuffix: true, locale: zhCN })}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 border-amber-500/50 text-amber-600">
                        {insp.status === 'pending' ? '待分析' : insp.status === 'analyzing' ? '分析中' : insp.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground">
                  <div className="text-center">
                    <Lightbulb className="size-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">暂无待处理灵感</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-primary mt-2"
                      onClick={() => setShowInspirationInput(true)}
                    >
                      表达想法
                    </Button>
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
          <CardContent className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            <Button
              variant="outline"
              className="justify-start gap-2 h-auto py-3"
              onClick={() => setShowInspirationInput(true)}
            >
              <Sparkles className="size-4 text-primary" />
              <span>表达想法</span>
              <ArrowRight className="size-3 ml-auto" />
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-2 h-auto py-3"
              onClick={() => setActiveView('board')}
            >
              <ListTodo className="size-4" />
              <span>新建 Issue</span>
              <ArrowRight className="size-3 ml-auto" />
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-2 h-auto py-3"
              onClick={() => setActiveView('agents')}
            >
              <Bot className="size-4" />
              <span>查看 Agent</span>
              <ArrowRight className="size-3 ml-auto" />
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Activity */}
      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="size-5 text-primary" />
              最近活动
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentLogs.length > 0 ? (
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {recentLogs.map((log, index) => {
                  const Icon = ACTION_ICONS[log.action] || Activity
                  const colorClass = ACTION_COLORS[log.action] || 'text-muted-foreground'
                  return (
                    <div key={log.id}>
                      <div className="flex items-start gap-3 py-2">
                        <div className="mt-0.5">
                          <Avatar className="size-7">
                            <AvatarImage src={log.actor?.avatar || undefined} alt={log.actor?.name} />
                            <AvatarFallback className={`text-[10px] ${log.actor?.type === 'agent' ? 'bg-primary/10 text-primary' : 'bg-blue-500/10 text-blue-600'}`}>
                              {log.actor?.type === 'agent' ? <Bot className="size-3" /> : log.actor?.name?.charAt(0).toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">{log.actor?.name || 'System'}</span>
                            <span className="text-muted-foreground"> {formatActionLabel(log.action, log.details)}</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: zhCN })}
                          </p>
                        </div>
                        <Icon className={`size-4 shrink-0 mt-1 ${colorClass}`} />
                      </div>
                      {index < recentLogs.length - 1 && <Separator />}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
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

      {/* System Status */}
      <motion.div variants={item}>
        <Card>
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
