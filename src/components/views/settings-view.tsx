'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Settings, Monitor, Bell, Shield, User, Server, Wifi, WifiOff,
  Plus, Trash2, Edit3, Save, X, Database, Brain, RefreshCw,
  RotateCcw, Key, Lock, Cpu, HardDrive, ToggleLeft, BookOpen,
  Code2, Heart, Workflow, Eye, MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  useDaemons, useCreateDaemon, useUpdateDaemon,
  useMemory, useCreateMemory, useUpdateMemory, useDeleteMemory,
} from '@/lib/hooks'
import { parseJsonField, type MemoryEntry } from '@/lib/api'
import { useCurrentUser } from '@/lib/use-current-user'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

// ============ Notification Preferences ============

const NOTIFICATION_KEYS = [
  { key: 'notify_issue_assigned', label: 'Issue 被指派', description: '当有Issue指派给你时通知', icon: User },
  { key: 'notify_status_changed', label: '状态变更', description: '当Issue状态变更时通知', icon: RefreshCw },
  { key: 'notify_agent_comment', label: 'Agent 评论', description: '当Agent添加评论时通知', icon: MessageSquare },
  { key: 'notify_inspiration_analyzed', label: '灵感分析完成', description: '当灵感被分析后通知', icon: Brain },
]

// ============ Memory Category Tabs ============

const MEMORY_CATEGORIES = [
  { value: 'code_style', label: '代码风格', icon: Code2 },
  { value: 'review_preference', label: '审查偏好', icon: Eye },
  { value: 'priority', label: '优先级', icon: Heart },
  { value: 'workflow', label: '工作流', icon: Workflow },
]

// ============ Section Configuration ============

const SECTIONS = [
  { id: 'profile', label: '个人资料', icon: User },
  { id: 'daemons', label: 'Daemon 管理', icon: Monitor },
  { id: 'notifications', label: '通知配置', icon: Bell },
  { id: 'preferences', label: '偏好记忆', icon: Brain },
  { id: 'security', label: '安全与权限', icon: Shield },
  { id: 'data', label: '数据管理', icon: Database },
]

// ============ Add Memory Dialog ============

function AddMemoryDialog({
  userId,
  category,
  open,
  onOpenChange,
}: {
  userId: string
  category: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [confidence, setConfidence] = useState(0.5)
  const createMemory = useCreateMemory()

  const handleSubmit = async () => {
    if (!key.trim()) {
      toast.error('请输入键名')
      return
    }
    try {
      await createMemory.mutateAsync({
        userId,
        category,
        key: key.trim(),
        value: value.trim(),
        confidence,
        source: 'manual',
      })
      toast.success('偏好已添加')
      onOpenChange(false)
      setKey('')
      setValue('')
      setConfidence(0.5)
    } catch (error) {
      toast.error(`添加失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>添加偏好</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="mem-key">键名 *</Label>
            <Input id="mem-key" placeholder="例如: max_line_length" value={key} onChange={(e) => setKey(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mem-value">值 *</Label>
            <Textarea id="mem-value" placeholder="偏好值..." value={value} onChange={(e) => setValue(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>置信度: {confidence.toFixed(1)}</Label>
            <Slider value={[confidence]} onValueChange={([v]) => setConfidence(v)} min={0} max={1} step={0.1} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={createMemory.isPending}>添加</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ Memory Entry Card ============

function MemoryEntryCard({
  entry,
  onDelete,
}: {
  entry: MemoryEntry
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(entry.value)
  const updateMemory = useUpdateMemory()

  const handleSave = async () => {
    try {
      await updateMemory.mutateAsync({ id: entry.id, data: { value: editValue } })
      toast.success('偏好已更新')
      setEditing(false)
    } catch (error) {
      toast.error(`更新失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-md border border-border/50 p-3 hover:border-border transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{entry.key}</span>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
            {Math.round(entry.confidence * 100)}%
          </Badge>
        </div>
        {editing ? (
          <div className="mt-1.5 space-y-2">
            <Textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={2} className="text-sm" />
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={handleSave}>
                <Save className="size-3" /> 保存
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditing(false)}>取消</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mt-0.5">{entry.value}</p>
        )}
      </div>
      {!editing && (
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="size-7 hover:text-primary transition-colors" onClick={() => { setEditValue(entry.value); setEditing(true) }}>
            <Edit3 className="size-3" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7 text-destructive hover:bg-destructive/10 transition-colors" onClick={() => onDelete(entry.id)}>
            <Trash2 className="size-3" />
          </Button>
        </div>
      )}
    </div>
  )
}

// ============ Section Header Component ============

function SectionHeader({ icon: Icon, title, action }: { icon: React.ElementType; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <CardTitle className="text-lg flex items-center gap-2.5">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary/10">
          <Icon className="size-3.5 text-primary" />
        </div>
        {title}
      </CardTitle>
      {action}
    </div>
  )
}

// ============ Main Component ============

export function SettingsView() {
  const { user, loading: userLoading, updateUser } = useCurrentUser()
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')

  const { data: daemons, isLoading: daemonsLoading } = useDaemons()
  const createDaemon = useCreateDaemon()

  // Memory state
  const [memCategory, setMemCategory] = useState('code_style')
  const [addMemOpen, setAddMemOpen] = useState(false)
  const [newDaemonOpen, setNewDaemonOpen] = useState(false)
  const [daemonForm, setDaemonForm] = useState({ name: '', host: '', port: '' })
  const [resetting, setResetting] = useState(false)
  const queryClient = useQueryClient()

  // Notification state from memory
  const { data: notifEntries } = useMemory(
    user ? { userId: user.id, category: 'notification' } : { userId: '', category: 'notification' }
  )
  const { data: memEntries, isLoading: memLoading } = useMemory(
    user ? { userId: user.id, category: memCategory } : { userId: '', category: memCategory }
  )
  const createMemory = useCreateMemory()
  const deleteMemory = useDeleteMemory()

  // Auto-approve threshold from memory
  const { data: securityEntries } = useMemory(
    user ? { userId: user.id, category: 'security' } : { userId: '', category: 'security' }
  )

  const autoApproveThreshold = useMemo(() => {
    if (!securityEntries) return 0.8
    const entry = securityEntries.find(e => e.key === 'auto_approve_threshold')
    return entry ? parseFloat(entry.value) : 0.8
  }, [securityEntries])

  const notifPrefs = useMemo(() => {
    const prefs: Record<string, boolean> = {}
    NOTIFICATION_KEYS.forEach(({ key }) => {
      prefs[key] = true // default on
    })
    if (notifEntries) {
      notifEntries.forEach(entry => {
        prefs[entry.key] = entry.value === 'true'
      })
    }
    return prefs
  }, [notifEntries])

  const handleSaveName = async () => {
    if (!nameValue.trim()) return
    await updateUser({ name: nameValue.trim() })
    setEditingName(false)
    toast.success('名称已更新')
  }

  const handleNotifToggle = async (key: string, enabled: boolean) => {
    if (!user) return
    try {
      await createMemory.mutateAsync({
        userId: user.id,
        category: 'notification',
        key,
        value: String(enabled),
        confidence: 1.0,
        source: 'user_preference',
      })
    } catch (error) {
      toast.error('保存失败')
    }
  }

  const handleAutoApproveChange = async (value: number) => {
    if (!user) return
    try {
      await createMemory.mutateAsync({
        userId: user.id,
        category: 'security',
        key: 'auto_approve_threshold',
        value: String(value),
        confidence: 1.0,
        source: 'user_preference',
      })
    } catch {
      toast.error('保存失败')
    }
  }

  const handleDeleteMemory = async (id: string) => {
    try {
      await deleteMemory.mutateAsync(id)
      toast.success('偏好已删除')
    } catch {
      toast.error('删除失败')
    }
  }

  const handleRegisterDaemon = async () => {
    if (!daemonForm.name.trim()) {
      toast.error('请输入名称')
      return
    }
    try {
      await createDaemon.mutateAsync({
        name: daemonForm.name.trim(),
        host: daemonForm.host.trim() || undefined,
        port: daemonForm.port ? parseInt(daemonForm.port, 10) : undefined,
        status: 'online',
        availableTools: [],
      })
      toast.success(`Daemon "${daemonForm.name}" 注册成功`)
      setNewDaemonOpen(false)
      setDaemonForm({ name: '', host: '', port: '' })
    } catch (error) {
      toast.error(`注册失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-3xl h-full overflow-y-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="size-6 text-primary" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">平台与个人偏好设置</p>
      </div>

      {/* Profile Section */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
            <SectionHeader icon={User} title="个人资料" />
          </CardHeader>
          <CardContent>
            {userLoading ? (
              <div className="flex items-center gap-4">
                <Skeleton className="size-12 rounded-full shimmer" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ) : user ? (
              <div className="flex items-start gap-4">
                <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-semibold text-lg shrink-0 ring-2 ring-primary/10">
                  {(user.name || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={nameValue}
                        onChange={(e) => setNameValue(e.target.value)}
                        className="h-8 w-48"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName() }}
                      />
                      <Button size="sm" variant="outline" className="h-8 gap-1" onClick={handleSaveName}>
                        <Save className="size-3" /> 保存
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingName(false)}>取消</Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{user.name || '用户'}</h3>
                      <Button variant="ghost" size="icon" className="size-6 hover:text-primary transition-colors" onClick={() => { setNameValue(user.name || ''); setEditingName(true) }}>
                        <Edit3 className="size-3" />
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs rounded-full">{user.role || 'member'}</Badge>
                    <span className="text-xs text-muted-foreground">{user.email || '未设置邮箱'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">ID: {user.id}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">正在加载用户信息...</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Daemon Management */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-teal-500/5 to-transparent">
            <SectionHeader
              icon={Monitor}
              title="Daemon 管理"
              action={
                <Button variant="outline" size="sm" className="gap-1 text-xs hover:-translate-y-0.5 transition-all" onClick={() => setNewDaemonOpen(true)}>
                  <Plus className="size-3" />
                  注册
                </Button>
              }
            />
          </CardHeader>
          <CardContent>
            {daemonsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full shimmer" />
                ))}
              </div>
            ) : daemons && daemons.length > 0 ? (
              <div className="space-y-2">
                {daemons.map((daemon) => {
                  const isOnline = daemon.status === 'online'
                  const rawTools = parseJsonField<string[]>(daemon.availableTools, [])
                  const tools = Array.isArray(rawTools) ? rawTools : []
                  return (
                    <div key={daemon.id} className={`flex items-center gap-3 rounded-md border p-3 transition-all duration-200 ${isOnline ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-border/50 hover:border-border'}`}>
                      <motion.div
                        animate={isOnline ? { scale: [1, 1.1, 1] } : {}}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        {isOnline ? (
                          <Wifi className="size-4 text-emerald-500 shrink-0" />
                        ) : (
                          <WifiOff className="size-4 text-muted-foreground shrink-0" />
                        )}
                      </motion.div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{daemon.name}</span>
                          <Badge variant={isOnline ? 'default' : 'secondary'} className="text-[10px] h-4 px-1.5 rounded-full">
                            {isOnline ? '在线' : '离线'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {daemon.host || 'localhost'}:{daemon.port || '-'}
                          {daemon.lastHeartbeat && (
                            <> · 心跳: {new Date(daemon.lastHeartbeat).toLocaleTimeString('zh-CN')}</>
                          )}
                        </p>
                        {tools.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {tools.map((tool) => (
                              <Badge key={tool} variant="outline" className="text-[10px] h-4 px-1 rounded-full">{tool}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <Server className="size-6 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">暂无已注册的 Daemon</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Notification Preferences */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-amber-500/5 to-transparent">
            <SectionHeader icon={Bell} title="通知配置" />
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {NOTIFICATION_KEYS.map(({ key, label, description, icon: ItemIcon }) => (
                <div key={key} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-md bg-muted group-hover:bg-primary/10 transition-colors">
                      <ItemIcon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={notifPrefs[key]}
                    onCheckedChange={(checked) => handleNotifToggle(key, checked)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Memory/Preferences Section */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-violet-500/5 to-transparent">
            <SectionHeader
              icon={Brain}
              title="偏好记忆"
              action={
                <Button variant="outline" size="sm" className="gap-1 text-xs hover:-translate-y-0.5 transition-all" onClick={() => setAddMemOpen(true)}>
                  <Plus className="size-3" />
                  添加
                </Button>
              }
            />
          </CardHeader>
          <CardContent>
            <Tabs value={memCategory} onValueChange={setMemCategory}>
              <TabsList className="mb-4">
                {MEMORY_CATEGORIES.map((cat) => {
                  const CatIcon = cat.icon
                  return (
                    <TabsTrigger key={cat.value} value={cat.value} className="text-xs gap-1.5">
                      <CatIcon className="size-3" />
                      {cat.label}
                    </TabsTrigger>
                  )
                })}
              </TabsList>

              {MEMORY_CATEGORIES.map((cat) => (
                <TabsContent key={cat.value} value={cat.value}>
                  {memLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full shimmer" />
                      ))}
                    </div>
                  ) : memEntries && memEntries.length > 0 ? (
                    <ScrollArea className="max-h-72">
                      <div className="space-y-2">
                        {memEntries.map((entry) => (
                          <MemoryEntryCard key={entry.id} entry={entry} onDelete={handleDeleteMemory} />
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-6">
                      <Database className="size-6 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">暂无{cat.label}偏好</p>
                      <Button variant="outline" size="sm" className="mt-2 gap-1 text-xs hover:-translate-y-0.5 transition-all" onClick={() => setAddMemOpen(true)}>
                        <Plus className="size-3" />
                        添加偏好
                      </Button>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>

      {/* Security Section */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-rose-500/5 to-transparent">
            <SectionHeader icon={Shield} title="安全与权限" />
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Working directory isolation */}
            <div>
              <h4 className="text-sm font-medium mb-1.5 flex items-center gap-2">
                <Lock className="size-3.5 text-muted-foreground" />
                工作目录隔离
              </h4>
              <p className="text-xs text-muted-foreground">
                每个Agent任务运行在独立的工作目录沙箱中，防止文件系统冲突和未授权访问。
              </p>
              <div className="flex items-center gap-2 mt-2 p-2.5 rounded-md bg-emerald-500/5 border border-emerald-500/20">
                <motion.div
                  className="size-2 rounded-full bg-emerald-500"
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className="text-xs text-emerald-600">沙箱隔离已启用</span>
              </div>
            </div>

            <Separator />

            {/* Agent permission levels */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Key className="size-3.5 text-muted-foreground" />
                Agent 权限级别
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-md border border-border/50 p-2.5 hover:border-emerald-500/30 transition-colors">
                  <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 rounded-full">读取</Badge>
                  <span className="text-xs text-muted-foreground">查看代码和文件</span>
                </div>
                <div className="flex items-center gap-3 rounded-md border border-border/50 p-2.5 hover:border-amber-500/30 transition-colors">
                  <Badge className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20 rounded-full">写入</Badge>
                  <span className="text-xs text-muted-foreground">修改指定工作目录中的文件</span>
                </div>
                <div className="flex items-center gap-3 rounded-md border border-border/50 p-2.5 hover:border-red-500/30 transition-colors">
                  <Badge className="text-[10px] bg-red-500/10 text-red-600 border-red-500/20 rounded-full">执行</Badge>
                  <span className="text-xs text-muted-foreground">运行CLI命令（受工具白名单限制）</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Auto-approve threshold */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <ToggleLeft className="size-3.5 text-muted-foreground" />
                  自动审批阈值
                </h4>
                <span className="text-sm font-semibold text-primary">{autoApproveThreshold.toFixed(1)}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Agent操作置信度超过此阈值时自动执行，低于阈值需人工确认
              </p>
              <Slider
                value={[autoApproveThreshold]}
                onValueChange={([v]) => handleAutoApproveChange(v)}
                min={0}
                max={1}
                step={0.1}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>全部需审批 (0)</span>
                <span>全部自动 (1)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Data Management Section */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-cyan-500/5 to-transparent">
            <SectionHeader icon={Database} title="数据管理" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">重置示例数据</p>
                <p className="text-xs text-muted-foreground">重新创建默认Agent团队、技能和示例Issue</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 hover:-translate-y-0.5 transition-all"
                disabled={resetting}
                onClick={async () => {
                  setResetting(true)
                  try {
                    const res = await fetch('/api/seed', { method: 'POST' })
                    if (!res.ok) throw new Error('Seed failed')
                    const data = await res.json()
                    await queryClient.invalidateQueries()
                    toast.success('示例数据已重置', {
                      description: `已创建 ${data.created?.agents || 0} 个Agent、${data.created?.skills || 0} 个技能、${data.created?.issues || 0} 个Issue`,
                    })
                  } catch {
                    toast.error('重置示例数据失败')
                  } finally {
                    setResetting(false)
                  }
                }}
              >
                <RotateCcw className={`size-3.5 ${resetting ? 'animate-spin' : ''}`} />
                {resetting ? '重置中...' : '重置示例数据'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Add Memory Dialog */}
      <AddMemoryDialog
        userId={user?.id || ''}
        category={memCategory}
        open={addMemOpen}
        onOpenChange={setAddMemOpen}
      />

      {/* Register Daemon Dialog */}
      <Dialog open={newDaemonOpen} onOpenChange={setNewDaemonOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="size-5 text-primary" />
              注册 Daemon
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="set-daemon-name">名称 *</Label>
              <Input id="set-daemon-name" placeholder="例如: local-daemon" value={daemonForm.name} onChange={(e) => setDaemonForm({ ...daemonForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>主机地址</Label>
                <Input placeholder="127.0.0.1" value={daemonForm.host} onChange={(e) => setDaemonForm({ ...daemonForm, host: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>端口</Label>
                <Input placeholder="3003" value={daemonForm.port} onChange={(e) => setDaemonForm({ ...daemonForm, port: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDaemonOpen(false)}>取消</Button>
            <Button onClick={handleRegisterDaemon} disabled={createDaemon.isPending}>
              {createDaemon.isPending ? '注册中...' : '注册'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
