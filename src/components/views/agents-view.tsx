'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Plus, Wifi, WifiOff, Clock, Eye, Trash2,
  Code2, FileCheck, FileText, BarChart3, Wrench, TestTube2, GitBranch,
  X, Save, Users, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  useAgents, useCreateMember, useUpdateMember, useDeleteMember,
  useDaemons, useIssues, useAuditLogs,
} from '@/lib/hooks'
import { parseJsonField, type Member } from '@/lib/api'
import { useCurrentUser } from '@/lib/use-current-user'
import { toast } from 'sonner'

// ============ Constants ============

const CAPABILITY_OPTIONS = [
  { value: 'code-gen', label: '代码生成', icon: Code2, gradient: 'from-emerald-500/15 to-teal-500/10' },
  { value: 'code-review', label: '代码审查', icon: FileCheck, gradient: 'from-violet-500/15 to-purple-500/10' },
  { value: 'fix-bug', label: 'Bug修复', icon: Wrench, gradient: 'from-red-500/15 to-orange-500/10' },
  { value: 'add-feature', label: '功能开发', icon: GitBranch, gradient: 'from-teal-500/15 to-cyan-500/10' },
  { value: 'doc', label: '文档', icon: FileText, gradient: 'from-amber-500/15 to-yellow-500/10' },
  { value: 'analysis', label: '分析', icon: BarChart3, gradient: 'from-rose-500/15 to-pink-500/10' },
  { value: 'testing', label: '测试', icon: TestTube2, gradient: 'from-lime-500/15 to-green-500/10' },
  { value: 'devops', label: 'DevOps', icon: Sparkles, gradient: 'from-cyan-500/15 to-sky-500/10' },
] as const

const AGENT_GROUP_GRADIENTS: Record<string, string> = {
  dev: 'from-emerald-500/10 via-teal-500/5 to-transparent',
  qa: 'from-violet-500/10 via-purple-500/5 to-transparent',
  docs: 'from-amber-500/10 via-yellow-500/5 to-transparent',
}

const AVATAR_COLORS = [
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-sky-600',
  'from-lime-500 to-green-600',
  'from-fuchsia-500 to-pink-600',
  'from-teal-500 to-cyan-600',
]

const DEFAULT_AGENTS = [
  {
    name: 'CodeAgent',
    description: '专注代码生成和功能开发的AI Agent',
    capabilities: ['code-gen', 'fix-bug', 'add-feature'],
    agentGroup: 'dev',
    systemPrompt: 'You are an expert coding agent. You write clean, efficient code and fix bugs systematically. Always follow best practices and write tests for your code.',
    agentStatus: 'online',
  },
  {
    name: 'ReviewBot',
    description: '专注代码审查和质量保证的AI Agent',
    capabilities: ['code-review', 'testing'],
    agentGroup: 'qa',
    systemPrompt: 'You are a code review specialist. You analyze code for bugs, security issues, performance problems, and style inconsistencies. You provide constructive feedback and suggest improvements.',
    agentStatus: 'online',
  },
  {
    name: 'DocAgent',
    description: '专注文档生成和数据分析的AI Agent',
    capabilities: ['doc', 'analysis'],
    agentGroup: 'docs',
    systemPrompt: 'You are a documentation and analysis agent. You create clear, comprehensive documentation and perform data analysis. You translate technical concepts into understandable language.',
    agentStatus: 'offline',
  },
]

// ============ Helper ============

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getStatusColor(status: string | null) {
  switch (status) {
    case 'online': return 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
    case 'busy': return 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]'
    default: return 'bg-gray-400'
  }
}

function getStatusLabel(status: string | null) {
  switch (status) {
    case 'online': return '在线'
    case 'busy': return '忙碌'
    default: return '离线'
  }
}

// ============ Register Agent Dialog ============

function RegisterAgentDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([])
  const [agentGroup, setAgentGroup] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [daemonId, setDaemonId] = useState('')
  const createMember = useCreateMember()
  const { data: daemons } = useDaemons()

  const toggleCapability = (cap: string) => {
    setSelectedCapabilities(prev =>
      prev.includes(cap) ? prev.filter(c => c !== cap) : [...prev, cap]
    )
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('请输入Agent名称')
      return
    }
    try {
      await createMember.mutateAsync({
        type: 'agent',
        name: name.trim(),
        description: description.trim() || undefined,
        capabilities: selectedCapabilities,
        agentGroup: agentGroup.trim() || undefined,
        systemPrompt: systemPrompt.trim() || undefined,
        daemonId: daemonId || undefined,
        agentStatus: 'offline',
      })
      toast.success(`Agent "${name}" 注册成功`)
      onOpenChange(false)
      resetForm()
    } catch (error) {
      toast.error(`注册失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  const resetForm = () => {
    setName('')
    setDescription('')
    setSelectedCapabilities([])
    setAgentGroup('')
    setSystemPrompt('')
    setDaemonId('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="size-5 text-primary" />
            注册 Agent
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="agent-name">名称 *</Label>
            <Input
              id="agent-name"
              placeholder="例如: CodeAgent"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-desc">描述</Label>
            <Textarea
              id="agent-desc"
              placeholder="描述此Agent的职责和能力..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>能力标签</Label>
            <div className="flex flex-wrap gap-2">
              {CAPABILITY_OPTIONS.map((cap) => {
                const isSelected = selectedCapabilities.includes(cap.value)
                return (
                  <button
                    key={cap.value}
                    onClick={() => toggleCapability(cap.value)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                      isSelected
                        ? `bg-gradient-to-r ${cap.gradient} text-foreground ring-1 ring-primary/30 shadow-sm`
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:scale-105'
                    }`}
                  >
                    <cap.icon className="size-3" />
                    {cap.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-group">Agent 组</Label>
            <Input
              id="agent-group"
              placeholder="例如: dev, qa, docs"
              value={agentGroup}
              onChange={(e) => setAgentGroup(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-prompt">系统提示词</Label>
            <Textarea
              id="agent-prompt"
              placeholder="定义Agent的行为和角色..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={4}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>绑定 Daemon</Label>
            <Select value={daemonId} onValueChange={setDaemonId}>
              <SelectTrigger>
                <SelectValue placeholder="选择Daemon（可选）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不绑定</SelectItem>
                {daemons?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} ({d.host}:{d.port})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={createMember.isPending}>
            {createMember.isPending ? '注册中...' : '注册 Agent'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ Agent Detail Sheet ============

function AgentDetailSheet({
  agent,
  open,
  onOpenChange,
}: {
  agent: Member | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editGroup, setEditGroup] = useState('')
  const [editPrompt, setEditPrompt] = useState('')
  const updateMember = useUpdateMember()
  const deleteMember = useDeleteMember()

  const { data: agentIssues } = useIssues({ assigneeId: agent?.id })
  const { data: agentLogs } = useAuditLogs({ actorId: agent?.id, limit: 10 })

  const capabilities = parseJsonField<string[]>(agent?.capabilities, [])
  const assignedIssues = agentIssues || []

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && agent) {
      setEditName(agent.name)
      setEditDesc(agent.description || '')
      setEditStatus(agent.agentStatus || 'offline')
      setEditGroup(agent.agentGroup || '')
      setEditPrompt(agent.systemPrompt || '')
      setEditing(false)
    }
    onOpenChange(isOpen)
  }

  const handleSave = async () => {
    if (!agent) return
    try {
      await updateMember.mutateAsync({
        id: agent.id,
        data: {
          name: editName,
          description: editDesc,
          agentStatus: editStatus,
          agentGroup: editGroup,
          systemPrompt: editPrompt,
        },
      })
      toast.success('Agent 信息已更新')
      setEditing(false)
    } catch (error) {
      toast.error(`更新失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  const handleDelete = async () => {
    if (!agent) return
    try {
      await deleteMember.mutateAsync(agent.id)
      toast.success(`Agent "${agent.name}" 已删除`)
      onOpenChange(false)
    } catch (error) {
      toast.error(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  if (!agent) return null

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent className="sm:max-w-[480px] w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <div className={`flex size-10 items-center justify-center rounded-full text-white font-semibold bg-gradient-to-br ${getAvatarColor(agent.name)} shadow-md`}>
              {agent.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              {editing ? (
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-lg font-semibold h-8"
                />
              ) : (
                <span>{agent.name}</span>
              )}
              <div className="flex items-center gap-2 mt-1">
                <motion.span
                  className={`size-2 rounded-full ${getStatusColor(agent.agentStatus)}`}
                  animate={agent.agentStatus === 'online' ? { scale: [1, 1.3, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
                <span className="text-xs text-muted-foreground">{getStatusLabel(agent.agentStatus)}</span>
                {agent.agentGroup && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">{agent.agentGroup}</Badge>
                )}
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Actions */}
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button size="sm" onClick={handleSave} disabled={updateMember.isPending} className="gap-1.5">
                  <Save className="size-3.5" />
                  保存
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>取消</Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1.5">
                  编辑
                </Button>
                <Button size="sm" variant="destructive" onClick={handleDelete} className="gap-1.5">
                  <Trash2 className="size-3.5" />
                  删除
                </Button>
              </>
            )}
          </div>

          {/* Description */}
          <div>
            <h4 className="text-sm font-medium mb-1.5">描述</h4>
            {editing ? (
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={2}
                placeholder="Agent描述..."
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {agent.description || '暂无描述'}
              </p>
            )}
          </div>

          {/* Status */}
          {editing && (
            <div>
              <h4 className="text-sm font-medium mb-1.5">状态</h4>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">在线</SelectItem>
                  <SelectItem value="busy">忙碌</SelectItem>
                  <SelectItem value="offline">离线</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Group */}
          {editing && (
            <div>
              <h4 className="text-sm font-medium mb-1.5">Agent组</h4>
              <Input
                value={editGroup}
                onChange={(e) => setEditGroup(e.target.value)}
                placeholder="例如: dev, qa"
              />
            </div>
          )}

          {/* Capabilities */}
          <div>
            <h4 className="text-sm font-medium mb-1.5">能力标签</h4>
            <div className="flex flex-wrap gap-1.5">
              {capabilities.length > 0 ? capabilities.map((cap) => {
                const option = CAPABILITY_OPTIONS.find(c => c.value === cap)
                return (
                  <Badge key={cap} variant="secondary" className={`text-xs gap-1 rounded-full bg-gradient-to-r ${option?.gradient || 'from-muted to-muted'} shadow-sm`}>
                    {option && <option.icon className="size-3" />}
                    {option?.label || cap}
                  </Badge>
                )
              }) : (
                <span className="text-xs text-muted-foreground">暂无能力标签</span>
              )}
            </div>
          </div>

          {/* Skills */}
          <div>
            <h4 className="text-sm font-medium mb-1.5">绑定技能</h4>
            <div className="flex flex-wrap gap-1.5">
              {agent.skills && agent.skills.length > 0 ? agent.skills.map((as) => (
                <Badge key={as.id} variant="outline" className="text-xs">
                  {as.skill.name}
                </Badge>
              )) : (
                <span className="text-xs text-muted-foreground">暂未绑定技能</span>
              )}
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <h4 className="text-sm font-medium mb-1.5">系统提示词</h4>
            {editing ? (
              <Textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                rows={4}
                className="font-mono text-sm"
                placeholder="定义Agent的行为和角色..."
              />
            ) : (
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground font-mono max-h-32 overflow-y-auto border border-border/30">
                {agent.systemPrompt || '暂无系统提示词'}
              </div>
            )}
          </div>

          <Separator />

          {/* Current Assignments */}
          <div>
            <h4 className="text-sm font-medium mb-2">当前任务</h4>
            {assignedIssues.length > 0 ? (
              <div className="space-y-1.5">
                {assignedIssues.slice(0, 5).map((issue) => (
                  <div
                    key={issue.id}
                    className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm border border-border/30 hover:border-border/60 transition-colors"
                  >
                    <span className={`size-2 rounded-full ${
                      issue.status === 'in_progress' ? 'bg-amber-500' :
                      issue.status === 'in_review' ? 'bg-teal-500' :
                      issue.status === 'resolved' ? 'bg-emerald-500' :
                      'bg-gray-400'
                    }`} />
                    <span className="flex-1 truncate">{issue.title}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                      {issue.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">暂无分配任务</p>
            )}
          </div>

          {/* Recent Activity */}
          <div>
            <h4 className="text-sm font-medium mb-2">最近活动</h4>
            {agentLogs?.data && agentLogs.data.length > 0 ? (
              <div className="space-y-1.5">
                {agentLogs.data.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground border border-border/30"
                  >
                    <span className="text-[10px] opacity-60">
                      {new Date(log.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="font-medium text-foreground/70">{log.action}</span>
                    <span className="truncate">{log.targetType}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">暂无活动记录</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ============ Main Component ============

export function AgentsView() {
  const [registerOpen, setRegisterOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<Member | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const { data: agents, isLoading } = useAgents()
  const createMember = useCreateMember()
  const { user: currentUser } = useCurrentUser()

  const statusCounts = useMemo(() => {
    const counts = { online: 0, busy: 0, offline: 0 }
    agents?.forEach((a) => {
      const s = a.agentStatus || 'offline'
      if (s in counts) counts[s as keyof typeof counts]++
    })
    return counts
  }, [agents])

  const handleViewDetails = (agent: Member) => {
    setSelectedAgent(agent)
    setDetailOpen(true)
  }

  const handleCreateDefaults = async () => {
    if (!currentUser) {
      toast.error('请稍等，正在初始化用户...')
      return
    }
    try {
      for (const agentDef of DEFAULT_AGENTS) {
        await createMember.mutateAsync({
          type: 'agent',
          name: agentDef.name,
          description: agentDef.description,
          capabilities: agentDef.capabilities,
          agentGroup: agentDef.agentGroup,
          systemPrompt: agentDef.systemPrompt,
          agentStatus: agentDef.agentStatus as 'online' | 'offline',
        })
      }
      toast.success('默认Agent团队创建成功！')
    } catch (error) {
      toast.error(`创建失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  return (
    <div className="space-y-6 p-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="size-6 text-primary" />
            Agents
          </h1>
          <p className="text-muted-foreground mt-1">管理和配置你的 AI Agent 团队成员</p>
        </div>
        <Button className="gap-2 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5" onClick={() => setRegisterOpen(true)}>
          <Plus className="size-4" />
          注册 Agent
        </Button>
      </div>

      {/* Agent Status Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300 dark:hover:border-emerald-600">
            <CardContent className="flex items-center gap-3 p-4 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
              <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 relative">
                <Wifi className="size-5 text-emerald-500" />
              </div>
              <div className="relative">
                <p className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-8" /> : statusCounts.online}</p>
                <p className="text-xs text-muted-foreground">在线</p>
              </div>
              {statusCounts.online > 0 && (
                <motion.div
                  className="ml-auto size-2 rounded-full bg-emerald-500"
                  animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-amber-300 dark:hover:border-amber-600">
            <CardContent className="flex items-center gap-3 p-4 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent" />
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/10 relative">
                <Clock className="size-5 text-amber-500" />
              </div>
              <div className="relative">
                <p className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-8" /> : statusCounts.busy}</p>
                <p className="text-xs text-muted-foreground">忙碌</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                <WifiOff className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-8" /> : statusCounts.offline}</p>
                <p className="text-xs text-muted-foreground">离线</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Agent Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="shimmer">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Skeleton className="size-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : agents && agents.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {agents.map((agent, i) => {
              const caps = parseJsonField<string[]>(agent.capabilities, [])
              const groupGradient = AGENT_GROUP_GRADIENTS[agent.agentGroup || ''] || 'from-primary/5 via-primary/3 to-transparent'
              return (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card
                    className="group hover:shadow-lg transition-all duration-300 cursor-pointer hover:-translate-y-1 overflow-hidden relative hover:border-primary/30"
                    onClick={() => handleViewDetails(agent)}
                  >
                    {/* Group-based gradient background */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${groupGradient} opacity-60 group-hover:opacity-100 transition-opacity duration-300`} />
                    <CardContent className="p-6 relative">
                      <div className="flex items-start gap-4">
                        {/* Avatar with gradient */}
                        <div className={`flex size-12 items-center justify-center rounded-full text-white font-semibold shrink-0 bg-gradient-to-br ${getAvatarColor(agent.name)} shadow-md group-hover:shadow-lg transition-shadow`}>
                          {agent.name.charAt(0).toUpperCase()}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm truncate">{agent.name}</h3>
                            <motion.span
                              className={`size-2 rounded-full shrink-0 ${getStatusColor(agent.agentStatus)}`}
                              animate={agent.agentStatus === 'online' ? { scale: [1, 1.3, 1] } : {}}
                              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                            />
                          </div>

                          <p className="text-xs text-muted-foreground mt-0.5">
                            {getStatusLabel(agent.agentStatus)}
                            {agent.agentGroup && ` · ${agent.agentGroup}`}
                          </p>

                          {/* Capabilities - pill style */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {caps.slice(0, 3).map((cap) => {
                              const option = CAPABILITY_OPTIONS.find(c => c.value === cap)
                              return (
                                <Badge key={cap} variant="secondary" className={`text-[10px] h-5 px-2 gap-0.5 rounded-full bg-gradient-to-r ${option?.gradient || 'from-muted to-muted'}`}>
                                  {option?.label || cap}
                                </Badge>
                              )
                            })}
                            {caps.length > 3 && (
                              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 rounded-full">
                                +{caps.length - 3}
                              </Badge>
                            )}
                          </div>

                          {/* Current task hint */}
                          {agent.assignedIssues && agent.assignedIssues.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-2 truncate">
                              📋 {agent.assignedIssues[0].title}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end mt-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-all duration-200 gap-1.5 text-xs hover:text-primary"
                          onClick={(e) => { e.stopPropagation(); handleViewDetails(agent) }}
                        >
                          <Eye className="size-3.5" />
                          查看详情
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      ) : (
        /* Empty State */
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="flex items-center justify-center size-16 rounded-full bg-muted mx-auto mb-4">
                <Users className="size-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-medium mb-1">还没有 Agent</h3>
              <p className="text-sm text-muted-foreground mb-4">
                创建你的AI Agent团队，开始协作开发
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button variant="outline" className="gap-2" onClick={() => setRegisterOpen(true)}>
                  <Plus className="size-4" />
                  手动注册
                </Button>
                <Button className="gap-2" onClick={handleCreateDefaults} disabled={createMember.isPending}>
                  <Bot className="size-4" />
                  {createMember.isPending ? '创建中...' : '创建默认Agent团队'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Register Dialog */}
      <RegisterAgentDialog open={registerOpen} onOpenChange={setRegisterOpen} />

      {/* Agent Detail Sheet */}
      <AgentDetailSheet
        agent={selectedAgent}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  )
}
