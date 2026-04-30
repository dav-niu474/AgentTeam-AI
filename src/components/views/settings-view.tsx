'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Settings, Monitor, Bell, Shield, User, Server, Wifi, WifiOff,
  Plus, Trash2, Edit3, Save, X, Database, Brain, RefreshCw,
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

// ============ Notification Preferences ============

const NOTIFICATION_KEYS = [
  { key: 'notify_issue_assigned', label: 'Issue 被指派', description: '当有Issue指派给你时通知' },
  { key: 'notify_status_changed', label: '状态变更', description: '当Issue状态变更时通知' },
  { key: 'notify_agent_comment', label: 'Agent 评论', description: '当Agent添加评论时通知' },
  { key: 'notify_inspiration_analyzed', label: '灵感分析完成', description: '当灵感被分析后通知' },
]

// ============ Memory Category Tabs ============

const MEMORY_CATEGORIES = [
  { value: 'code_style', label: '代码风格' },
  { value: 'review_preference', label: '审查偏好' },
  { value: 'priority', label: '优先级' },
  { value: 'workflow', label: '工作流' },
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
    <div className="flex items-start gap-3 rounded-md border border-border/50 p-3">
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
          <Button variant="ghost" size="icon" className="size-7" onClick={() => { setEditValue(entry.value); setEditing(true) }}>
            <Edit3 className="size-3" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => onDelete(entry.id)}>
            <Trash2 className="size-3" />
          </Button>
        </div>
      )}
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="size-4" />
              个人资料
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userLoading ? (
              <div className="flex items-center gap-4">
                <Skeleton className="size-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ) : user ? (
              <div className="flex items-start gap-4">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-lg shrink-0">
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
                      <Button variant="ghost" size="icon" className="size-6" onClick={() => { setNameValue(user.name || ''); setEditingName(true) }}>
                        <Edit3 className="size-3" />
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">{user.role || 'member'}</Badge>
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Monitor className="size-4" />
              Daemon 管理
            </CardTitle>
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setNewDaemonOpen(true)}>
              <Plus className="size-3" />
              注册
            </Button>
          </CardHeader>
          <CardContent>
            {daemonsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : daemons && daemons.length > 0 ? (
              <div className="space-y-2">
                {daemons.map((daemon) => {
                  const isOnline = daemon.status === 'online'
                  const tools = parseJsonField<string[]>(daemon.availableTools, [])
                  return (
                    <div key={daemon.id} className="flex items-center gap-3 rounded-md border border-border/50 p-3">
                      {isOnline ? (
                        <Wifi className="size-4 text-emerald-500 shrink-0" />
                      ) : (
                        <WifiOff className="size-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{daemon.name}</span>
                          <Badge variant={isOnline ? 'default' : 'secondary'} className="text-[10px] h-4 px-1.5">
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
                              <Badge key={tool} variant="outline" className="text-[10px] h-4 px-1">{tool}</Badge>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="size-4" />
              通知配置
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {NOTIFICATION_KEYS.map(({ key, label, description }) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="size-4" />
              偏好记忆
            </CardTitle>
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setAddMemOpen(true)}>
              <Plus className="size-3" />
              添加
            </Button>
          </CardHeader>
          <CardContent>
            <Tabs value={memCategory} onValueChange={setMemCategory}>
              <TabsList className="mb-4">
                {MEMORY_CATEGORIES.map((cat) => (
                  <TabsTrigger key={cat.value} value={cat.value} className="text-xs">
                    {cat.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {MEMORY_CATEGORIES.map((cat) => (
                <TabsContent key={cat.value} value={cat.value}>
                  {memLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full" />
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
                      <Button variant="outline" size="sm" className="mt-2 gap-1 text-xs" onClick={() => setAddMemOpen(true)}>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="size-4" />
              安全与权限
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Working directory isolation */}
            <div>
              <h4 className="text-sm font-medium mb-1.5">工作目录隔离</h4>
              <p className="text-xs text-muted-foreground">
                每个Agent任务运行在独立的工作目录沙箱中，防止文件系统冲突和未授权访问。
              </p>
              <div className="flex items-center gap-2 mt-2 p-2.5 rounded-md bg-emerald-500/5 border border-emerald-500/20">
                <div className="size-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-emerald-600">沙箱隔离已启用</span>
              </div>
            </div>

            <Separator />

            {/* Agent permission levels */}
            <div>
              <h4 className="text-sm font-medium mb-2">Agent 权限级别</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-md border border-border/50 p-2.5">
                  <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">读取</Badge>
                  <span className="text-xs text-muted-foreground">查看代码和文件</span>
                </div>
                <div className="flex items-center gap-3 rounded-md border border-border/50 p-2.5">
                  <Badge className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">写入</Badge>
                  <span className="text-xs text-muted-foreground">修改指定工作目录中的文件</span>
                </div>
                <div className="flex items-center gap-3 rounded-md border border-border/50 p-2.5">
                  <Badge className="text-[10px] bg-red-500/10 text-red-600 border-red-500/20">执行</Badge>
                  <span className="text-xs text-muted-foreground">运行CLI命令（受工具白名单限制）</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Auto-approve threshold */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">自动审批阈值</h4>
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
