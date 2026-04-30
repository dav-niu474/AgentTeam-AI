'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, Terminal, Server, Monitor, Plus,
  RefreshCw, Filter, Wifi, WifiOff, Clock,
  ChevronDown, ChevronRight, Cpu, HardDrive,
  ArrowUp, ArrowDown, Minus, ScrollText,
  CircleDot, Zap, Eye, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  useAuditLogs, useSessions, useDaemons, useStats,
  useCreateDaemon, useUpdateDaemon,
} from '@/lib/hooks'
import { parseJsonField, type Session } from '@/lib/api'
import { toast } from 'sonner'

// ============ Gauge Bar Component ============

function GaugeBar({ value, max = 100, label, color, icon: Icon }: {
  value: number; max?: number; label: string; color: string; icon: React.ElementType
}) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="flex items-center gap-3">
      <div className={`flex size-7 items-center justify-center rounded-md ${color.replace('bg-', 'bg-').split('-')[0]}-500/10`}>
        <Icon className={`size-3.5 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium">{label}</span>
          <span className="text-xs font-bold tabular-nums">{value}<span className="text-muted-foreground font-normal">/{max}</span></span>
        </div>
        <div className="h-2 rounded-full bg-muted/80 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${color}`}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  )
}

// ============ Health Score Ring ============

function HealthScoreRing({ value }: { value: number }) {
  const size = 80
  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (value / 100) * circumference

  const getColor = (v: number) => {
    if (v >= 80) return '#10b981'
    if (v >= 60) return '#f59e0b'
    return '#ef4444'
  }

  return (
    <div className="relative">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor(value)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold" style={{ color: getColor(value) }}>{value}</span>
        <span className="text-[8px] text-muted-foreground">/100</span>
      </div>
    </div>
  )
}

// ============ Register Daemon Dialog ============

function RegisterDaemonDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('')
  const createDaemon = useCreateDaemon()

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('请输入Daemon名称')
      return
    }
    try {
      await createDaemon.mutateAsync({
        name: name.trim(),
        host: host.trim() || undefined,
        port: port ? parseInt(port, 10) : undefined,
        status: 'online',
        availableTools: [],
      })
      toast.success(`Daemon "${name}" 注册成功`)
      onOpenChange(false)
      setName('')
      setHost('')
      setPort('')
    } catch (error) {
      toast.error(`注册失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="size-5 text-primary" />
            注册 Daemon
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="daemon-name">名称 *</Label>
            <Input id="daemon-name" placeholder="例如: local-daemon" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="daemon-host">主机地址</Label>
              <Input id="daemon-host" placeholder="127.0.0.1" value={host} onChange={(e) => setHost(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="daemon-port">端口</Label>
              <Input id="daemon-port" placeholder="3003" value={port} onChange={(e) => setPort(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={createDaemon.isPending}>
            {createDaemon.isPending ? '注册中...' : '注册'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ Session Detail Sheet ============

function SessionDetailSheet({
  session,
  open,
  onOpenChange,
}: {
  session: Session | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!session) return null

  const messages = parseJsonField<unknown[]>(session.messages as string, [])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[520px] w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">会话详情</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Agent</span>
              <p className="font-medium">{session.agent?.name || '-'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Issue</span>
              <p className="font-medium truncate">{session.issue?.title || '-'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">状态</span>
              <p><Badge variant="outline" className="text-xs">{session.status}</Badge></p>
            </div>
            <div>
              <span className="text-muted-foreground">消息数</span>
              <p className="font-medium">{Array.isArray(messages) ? messages.length : 0}</p>
            </div>
          </div>
          <Separator />
          <div>
            <h4 className="text-sm font-medium mb-2">消息历史</h4>
            <ScrollArea className="h-[400px]">
              {Array.isArray(messages) && messages.length > 0 ? (
                <div className="space-y-2">
                  {messages.map((msg, i) => (
                    <div key={i} className="rounded-md bg-muted/50 p-3 text-sm font-mono border border-border/30">
                      <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(msg, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂无消息记录</p>
              )}
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ============ Log Entry ============

function LogEntry({ log, isNew }: { log: { id: string; createdAt: string; actorType: string; actor?: { name: string }; action: string; targetType: string; targetId: string }; isNew?: boolean }) {
  const actorColor = log.actorType === 'agent' ? 'text-emerald-400' : log.actorType === 'human' ? 'text-sky-400' : 'text-gray-400'
  const actorLabel = log.actorType === 'agent' ? 'AGENT' : log.actorType === 'human' ? 'HUMAN' : 'SYS'

  const actionColor = (() => {
    if (log.action.includes('create')) return 'text-emerald-300'
    if (log.action.includes('delete')) return 'text-red-400'
    if (log.action.includes('status') || log.action.includes('change')) return 'text-amber-300'
    if (log.action.includes('comment')) return 'text-sky-300'
    if (log.action.includes('analyze')) return 'text-violet-300'
    if (log.action.includes('assign')) return 'text-cyan-300'
    return 'text-gray-300'
  })()

  const timeStr = new Date(log.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <motion.div
      initial={isNew ? { opacity: 0, x: -8 } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`flex items-start gap-2 py-1.5 px-2 hover:bg-white/10 rounded text-xs font-mono transition-colors group ${log.actorType === 'agent' ? 'bg-emerald-500/5' : log.actorType === 'human' ? 'bg-sky-500/5' : log.actorType === 'system' ? 'bg-amber-500/5' : ''}`}
    >
      <span className="text-gray-500 shrink-0 tabular-nums w-16">
        {timeStr}
      </span>
      <span className={`${actorColor} shrink-0 font-semibold`}>
        [{actorLabel}/{log.actor?.name || 'unknown'}]
      </span>
      <span className={actionColor}>
        {log.action}
      </span>
      <span className="text-gray-500 truncate">
        → {log.targetType}:{log.targetId.slice(0, 8)}
      </span>
    </motion.div>
  )
}

// ============ Filter Pill ============

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-200 ${
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50'
      }`}
    >
      {label}
    </button>
  )
}

// ============ Main Component ============

export function MonitorView() {
  const [registerDaemonOpen, setRegisterDaemonOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [sessionDetailOpen, setSessionDetailOpen] = useState(false)
  const [filterActorType, setFilterActorType] = useState<string>('all')
  const [filterAction, setFilterAction] = useState<string>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const logEndRef = useRef<HTMLDivElement>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const prevLogCountRef = useRef(0)

  // Auto-refresh logs every 10 seconds
  const { data: auditData, isLoading: logsLoading, refetch: refetchLogs } = useAuditLogs({ limit: 50 })
  const { data: sessions, isLoading: sessionsLoading } = useSessions({ status: 'active' })
  const { data: daemons, isLoading: daemonsLoading } = useDaemons()
  const { data: stats } = useStats()
  const updateDaemon = useUpdateDaemon()

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      refetchLogs()
    }, 10000)
    return () => clearInterval(interval)
  }, [refetchLogs])

  // Auto-scroll to bottom (only when enabled)
  useEffect(() => {
    if (autoScroll) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [auditData, autoScroll])

  const filteredLogs = useMemo(() => {
    if (!auditData?.data) return []
    return auditData.data.filter((log) => {
      if (filterActorType !== 'all' && log.actorType !== filterActorType) return false
      if (filterAction !== 'all' && log.action !== filterAction) return false
      return true
    })
  }, [auditData, filterActorType, filterAction])

  const actionTypes = useMemo(() => {
    if (!auditData?.data) return []
    const actions = new Set(auditData.data.map(l => l.action))
    return Array.from(actions)
  }, [auditData])

  // Simulated metrics for gauges
  const cpuUsage = useMemo(() => {
    const online = stats?.agents.byStatus.online ?? 0
    const total = stats?.agents.total ?? 1
    return Math.round((online / total) * 100)
  }, [stats])

  const memoryUsage = useMemo(() => {
    const active = stats?.sessions.active ?? 0
    return Math.min(active * 15 + 20, 100)
  }, [stats])

  const healthScore = useMemo(() => {
    const daemonOnline = stats?.daemons.online ?? 0
    const agentOnline = stats?.agents.byStatus.online ?? 0
    const totalAgents = stats?.agents.total ?? 1
    const totalDaemons = Math.max(stats?.daemons.total ?? 0, 1)
    const agentHealth = (agentOnline / totalAgents) * 60
    const daemonHealth = (daemonOnline / totalDaemons) * 40
    return Math.round(agentHealth + daemonHealth)
  }, [stats])

  const handleDaemonHeartbeat = async (daemonId: string) => {
    try {
      await updateDaemon.mutateAsync({ id: daemonId, data: { status: 'online' } })
      toast.success('心跳已更新')
    } catch {
      toast.error('心跳更新失败')
    }
  }

  const handleViewSession = (session: Session) => {
    setSelectedSession(session)
    setSessionDetailOpen(true)
  }

  const clearActionFilter = useCallback(() => setFilterAction('all'), [])
  const clearActorFilter = useCallback(() => setFilterActorType('all'), [])

  return (
    <div className="space-y-6 p-4 md:p-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="size-6 text-primary" />
            Monitor
          </h1>
          <p className="text-muted-foreground mt-1">实时监控 Agent 执行日志与系统事件</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 hover:-translate-y-0.5 transition-all" onClick={() => refetchLogs()}>
          <RefreshCw className="size-3.5" />
          刷新
        </Button>
      </div>

      {/* System Health Section with gradient header */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-primary/10 via-emerald-500/5 to-transparent">
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="size-4 text-primary" />
            系统状态
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {/* Gauge cards row */}
          <div className="grid gap-4 md:grid-cols-2">
            <GaugeBar
              value={cpuUsage}
              max={100}
              label="CPU (Agent 活跃度)"
              color="bg-emerald-500"
              icon={Cpu}
            />
            <GaugeBar
              value={memoryUsage}
              max={100}
              label="Memory (会话负载)"
              color="bg-teal-500"
              icon={HardDrive}
            />
          </div>

          {/* Metric cards row */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
              <div className="rounded-lg border border-border/50 p-3 bg-gradient-to-br from-emerald-500/5 to-transparent">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex size-6 items-center justify-center rounded-full bg-emerald-500/10">
                    <Cpu className="size-3 text-emerald-500" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">在线 Agent</span>
                </div>
                <p className="text-xl font-bold">{stats?.agents.byStatus.online ?? 0}<span className="text-muted-foreground text-xs">/{stats?.agents.total ?? 0}</span></p>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <div className="rounded-lg border border-border/50 p-3 bg-gradient-to-br from-teal-500/5 to-transparent">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex size-6 items-center justify-center rounded-full bg-teal-500/10">
                    <HardDrive className="size-3 text-teal-500" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">在线 Daemon</span>
                </div>
                <p className="text-xl font-bold">{stats?.daemons.online ?? 0}</p>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="rounded-lg border border-border/50 p-3 bg-gradient-to-br from-amber-500/5 to-transparent">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex size-6 items-center justify-center rounded-full bg-amber-500/10">
                    <Monitor className="size-3 text-amber-500" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">活跃会话</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold">{stats?.sessions.active ?? 0}</p>
                  {(stats?.sessions.active ?? 0) > 0 && (
                    <span className="relative flex size-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full size-2 bg-amber-500" />
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <div className="rounded-lg border border-border/50 p-3 bg-gradient-to-br from-rose-500/5 to-transparent">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex size-6 items-center justify-center rounded-full bg-rose-500/10">
                    <Activity className="size-3 text-rose-500" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">总 Issue</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xl font-bold">{stats?.issues.total ?? 0}</p>
                  {(stats?.issues.total ?? 0) > 0 && (
                    <ArrowUp className="size-3 text-emerald-500" />
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          <Separator />

          {/* Health Score */}
          <div className="flex items-center gap-4">
            <HealthScoreRing value={healthScore} />
            <div className="flex-1">
              <p className="text-sm font-medium">系统健康度</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                基于 Agent 在线率与 Daemon 在线率综合计算
              </p>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1 text-xs">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span className="text-muted-foreground">Agent: {stats?.agents.byStatus.online ?? 0}/{stats?.agents.total ?? 0}</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <span className="size-2 rounded-full bg-teal-500" />
                  <span className="text-muted-foreground">Daemon: {stats?.daemons.online ?? 0}/{stats?.daemons.total ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content: 2 columns */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left: Execution Log */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 bg-gradient-to-r from-gray-950 to-gray-900 dark:from-gray-950 dark:to-gray-900 border-b border-gray-800">
            <CardTitle className="text-base flex items-center gap-2 text-gray-200">
              <Terminal className="size-4" />
              执行日志
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] gap-1 border-emerald-500/30 text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                实时
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 text-xs gap-1 border border-gray-700 ${autoScroll ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'text-gray-400'}`}
                onClick={() => setAutoScroll(!autoScroll)}
              >
                <ScrollText className="size-3" />
                {autoScroll ? '自动滚动' : '手动'}
              </Button>
              <Select value={filterActorType} onValueChange={setFilterActorType}>
                <SelectTrigger className="h-7 w-24 text-xs border-gray-700 bg-gray-800 text-gray-300">
                  <SelectValue placeholder="类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="human">Human</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="h-7 w-28 text-xs border-gray-700 bg-gray-800 text-gray-300">
                  <SelectValue placeholder="操作" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部操作</SelectItem>
                  {actionTypes.map((action) => (
                    <SelectItem key={action} value={action}>{action}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Filter pills */}
            {(filterActorType !== 'all' || filterAction !== 'all') && (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-800">
                <span className="text-[10px] text-gray-500">筛选:</span>
                {filterActorType !== 'all' && (
                  <FilterPill
                    label={filterActorType === 'agent' ? 'Agent' : filterActorType === 'human' ? 'Human' : 'System'}
                    active
                    onClick={clearActorFilter}
                  />
                )}
                {filterAction !== 'all' && (
                  <FilterPill
                    label={filterAction}
                    active
                    onClick={clearActionFilter}
                  />
                )}
                <button
                  className="text-[10px] text-gray-500 hover:text-gray-300 ml-auto"
                  onClick={() => { setFilterActorType('all'); setFilterAction('all') }}
                >
                  清除全部
                </button>
              </div>
            )}
            <div ref={logContainerRef} className="rounded-b-lg bg-gray-950 border border-gray-800 border-t-0 p-3 min-h-[400px] max-h-[500px] overflow-y-auto scrollbar-hidden">
              {logsLoading ? (
                <div className="flex items-center justify-center h-40 text-gray-500">
                  <RefreshCw className="size-5 animate-spin" />
                </div>
              ) : filteredLogs.length > 0 ? (
                <div>
                  <AnimatePresence>
                    {filteredLogs.map((log, idx) => (
                      <LogEntry
                        key={log.id}
                        log={log}
                        isNew={idx >= filteredLogs.length - 3}
                      />
                    ))}
                  </AnimatePresence>
                  <div ref={logEndRef} className="terminal-cursor" />
                </div>
              ) : (
                <div className="flex items-center justify-center h-40">
                  <div className="text-center text-gray-500">
                    <Terminal className="size-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">暂无日志记录</p>
                    <p className="text-xs mt-1">Agent 开始执行后，日志将实时显示在这里</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right Sidebar: Sessions + Daemons */}
        <div className="space-y-6">
          {/* Active Sessions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Monitor className="size-4" />
                活跃会话
                {sessions && sessions.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{sessions.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sessionsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full shimmer" />
                  ))}
                </div>
              ) : sessions && sessions.length > 0 ? (
                <ScrollArea className="max-h-60">
                  <div className="space-y-1.5">
                    {sessions.map((session) => (
                      <button
                        key={session.id}
                        onClick={() => handleViewSession(session)}
                        className="w-full text-left rounded-md border border-border/50 p-2.5 hover:bg-accent/50 transition-all duration-200 hover:border-primary/30 hover:translate-x-0.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium truncate">{session.agent?.name || 'Unknown'}</span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0">{session.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{session.issue?.title || 'No Issue'}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {new Date(session.createdAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">暂无活跃会话</p>
              )}
            </CardContent>
          </Card>

          {/* Daemon Status */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="size-4" />
                Daemon 状态
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setRegisterDaemonOpen(true)}>
                <Plus className="size-3" />
                注册
              </Button>
            </CardHeader>
            <CardContent>
              {daemonsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full shimmer" />
                  ))}
                </div>
              ) : daemons && daemons.length > 0 ? (
                <div className="space-y-2">
                  {daemons.map((daemon) => {
                    const rawTools = parseJsonField<string[]>(daemon.availableTools, [])
                    const tools = Array.isArray(rawTools) ? rawTools : []
                    const isOnline = daemon.status === 'online'
                    const heartbeatAge = daemon.lastHeartbeat
                      ? Math.round((Date.now() - new Date(daemon.lastHeartbeat).getTime()) / 60000)
                      : null

                    return (
                      <div
                        key={daemon.id}
                        className={`rounded-md border p-3 transition-all duration-200 ${
                          isOnline
                            ? 'border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40'
                            : 'border-border/50 hover:border-border'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isOnline ? (
                              <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                              >
                                <span className="relative flex size-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full size-3 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                                </span>
                              </motion.div>
                            ) : (
                              <span className="flex size-3 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
                            )}
                            <span className="text-sm font-medium">{daemon.name}</span>
                          </div>
                          <Badge variant={isOnline ? 'default' : 'secondary'} className="text-[10px] h-4 px-1.5">
                            {isOnline ? '在线' : '离线'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-muted-foreground">
                            {daemon.host || 'localhost'}:{daemon.port || '-'}
                          </span>
                          {heartbeatAge !== null && (
                            <span className="text-[10px] text-muted-foreground/60">
                              · 心跳 {heartbeatAge === 0 ? '刚刚' : `${heartbeatAge}分钟前`}
                            </span>
                          )}
                        </div>
                        {tools.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {tools.map((tool) => (
                              <Badge key={tool} variant="outline" className="text-[10px] h-4 px-1">{tool}</Badge>
                            ))}
                          </div>
                        )}
                        <div className="flex justify-end mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] gap-1"
                            onClick={() => handleDaemonHeartbeat(daemon.id)}
                          >
                            <RefreshCw className="size-2.5" />
                            心跳
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Server className="size-6 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">暂无已注册的 Daemon</p>
                  <Button variant="outline" size="sm" className="mt-2 gap-1 text-xs" onClick={() => setRegisterDaemonOpen(true)}>
                    <Plus className="size-3" />
                    注册第一个
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Issues by status mini-chart */}
          {stats && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="size-4" />
                  Issue 分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(stats.issues.byStatus).map(([status, count]) => {
                    const total = stats.issues.total || 1
                    const pct = Math.round((count / total) * 100)
                    const color =
                      status === 'open' ? 'bg-gray-400' :
                      status === 'triaged' ? 'bg-teal-400' :
                      status === 'in_progress' ? 'bg-amber-400' :
                      status === 'in_review' ? 'bg-violet-400' :
                      status === 'resolved' ? 'bg-emerald-400' :
                      'bg-gray-300'
                    return (
                      <div key={status} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-20 shrink-0">{status}</span>
                        <div className="flex-1 h-2 rounded-full bg-gradient-to-r from-muted to-muted/50 overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${color}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                        <span className="text-xs font-medium w-6 text-right">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Register Daemon Dialog */}
      <RegisterDaemonDialog open={registerDaemonOpen} onOpenChange={setRegisterDaemonOpen} />

      {/* Session Detail Sheet */}
      <SessionDetailSheet
        session={selectedSession}
        open={sessionDetailOpen}
        onOpenChange={setSessionDetailOpen}
      />
    </div>
  )
}

