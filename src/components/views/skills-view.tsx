'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, Plus, Trash2, Edit3, BookOpen, Code2, FileText,
  BarChart3, Search, Wrench, GitBranch, Terminal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  useSkills, useCreateSkill, useUpdateSkill, useDeleteSkill,
} from '@/lib/hooks'
import { parseJsonField, type Skill } from '@/lib/api'
import { toast } from 'sonner'

// ============ Constants ============

const SCENE_OPTIONS = [
  { value: 'code-gen', label: '代码生成', icon: Code2, color: 'bg-emerald-500/10 text-emerald-600' },
  { value: 'review', label: '代码审查', icon: Search, color: 'bg-blue-500/10 text-blue-600' },
  { value: 'doc', label: '文档', icon: FileText, color: 'bg-amber-500/10 text-amber-600' },
  { value: 'analysis', label: '分析', icon: BarChart3, color: 'bg-violet-500/10 text-violet-600' },
  { value: 'custom', label: '自定义', icon: Wrench, color: 'bg-gray-500/10 text-gray-600' },
] as const

const DEFAULT_SKILLS = [
  {
    name: 'Bug修复',
    description: '自动定位和修复代码中的Bug，包括错误分析、根因定位和补丁生成',
    promptTemplate: '你是一个专业的Bug修复专家。请分析以下Bug描述和相关代码，定位问题根因，并生成修复方案。\n\n## Bug描述\n{{bug_description}}\n\n## 相关代码\n{{code_context}}\n\n请输出：\n1. 问题分析\n2. 修复方案\n3. 修复代码',
    requiredTools: ['git', 'node', 'npm'],
    acceptanceCriteria: 'Bug被修复，测试通过，无回归',
    scene: 'code-gen',
    isBuiltIn: true,
  },
  {
    name: '功能开发',
    description: '根据需求描述开发新功能，包括代码实现、测试编写和文档更新',
    promptTemplate: '你是一个专业的功能开发工程师。请根据以下需求开发新功能。\n\n## 需求描述\n{{feature_description}}\n\n## 技术约束\n{{constraints}}\n\n请输出：\n1. 设计方案\n2. 实现代码\n3. 测试用例',
    requiredTools: ['git', 'node', 'npm'],
    acceptanceCriteria: '功能实现完整，测试覆盖，代码符合规范',
    scene: 'code-gen',
    isBuiltIn: true,
  },
  {
    name: '代码审查',
    description: '对代码变更进行专业审查，关注代码质量、安全性和性能问题',
    promptTemplate: '你是一个严格的代码审查专家。请审查以下代码变更。\n\n## 变更内容\n{{diff}}\n\n## 审查重点\n1. 代码质量\n2. 潜在Bug\n3. 安全问题\n4. 性能优化\n5. 代码风格\n\n请输出审查意见和改进建议。',
    requiredTools: ['git'],
    acceptanceCriteria: '审查覆盖所有关键维度，提供可操作的建议',
    scene: 'review',
    isBuiltIn: true,
  },
  {
    name: '文档生成',
    description: '自动生成项目文档、API文档和代码注释',
    promptTemplate: '你是一个专业的技术文档撰写者。请根据以下代码和需求生成文档。\n\n## 代码\n{{code}}\n\n## 文档类型\n{{doc_type}}\n\n请生成清晰、完整的技术文档。',
    requiredTools: [],
    acceptanceCriteria: '文档完整准确，格式规范，易于理解',
    scene: 'doc',
    isBuiltIn: true,
  },
  {
    name: '数据分析',
    description: '执行数据分析和可视化，生成分析报告',
    promptTemplate: '你是一个专业的数据分析师。请分析以下数据。\n\n## 数据描述\n{{data_description}}\n\n## 分析目标\n{{analysis_goal}}\n\n请输出：\n1. 数据概览\n2. 分析结果\n3. 可视化建议\n4. 结论和建议',
    requiredTools: ['python'],
    acceptanceCriteria: '分析方法正确，结果可靠，报告清晰',
    scene: 'analysis',
    isBuiltIn: true,
  },
]

const SKILL_COLORS = [
  'bg-emerald-500/10 text-emerald-600',
  'bg-teal-500/10 text-teal-600',
  'bg-cyan-500/10 text-cyan-600',
  'bg-violet-500/10 text-violet-600',
  'bg-rose-500/10 text-rose-600',
  'bg-amber-500/10 text-amber-600',
]

function getSkillColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return SKILL_COLORS[Math.abs(hash) % SKILL_COLORS.length]
}

// ============ Create Skill Dialog ============

function CreateSkillDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [promptTemplate, setPromptTemplate] = useState('')
  const [toolInput, setToolInput] = useState('')
  const [requiredTools, setRequiredTools] = useState<string[]>([])
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('')
  const [scene, setScene] = useState('')
  const createSkill = useCreateSkill()

  const addTool = () => {
    const tool = toolInput.trim()
    if (tool && !requiredTools.includes(tool)) {
      setRequiredTools([...requiredTools, tool])
      setToolInput('')
    }
  }

  const removeTool = (tool: string) => {
    setRequiredTools(requiredTools.filter(t => t !== tool))
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('请输入技能名称')
      return
    }
    if (!description.trim()) {
      toast.error('请输入技能描述')
      return
    }
    if (!promptTemplate.trim()) {
      toast.error('请输入Prompt模板')
      return
    }
    try {
      await createSkill.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        promptTemplate: promptTemplate.trim(),
        requiredTools: requiredTools.length > 0 ? requiredTools : undefined,
        acceptanceCriteria: acceptanceCriteria.trim() || undefined,
        scene: scene || undefined,
      })
      toast.success(`技能 "${name}" 创建成功`)
      onOpenChange(false)
      resetForm()
    } catch (error) {
      toast.error(`创建失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  const resetForm = () => {
    setName('')
    setDescription('')
    setPromptTemplate('')
    setToolInput('')
    setRequiredTools([])
    setAcceptanceCriteria('')
    setScene('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="size-5 text-primary" />
            创建 Skill
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="skill-name">名称 *</Label>
            <Input
              id="skill-name"
              placeholder="例如: Bug修复"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill-desc">描述 *</Label>
            <Textarea
              id="skill-desc"
              placeholder="描述此技能的用途和功能..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill-prompt">Prompt 模板 *</Label>
            <Textarea
              id="skill-prompt"
              placeholder={'使用 {{variable}} 作为变量占位符\n\n例如:\n你是一个{{role}}专家。请分析以下内容：\n{{content}}'}
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              rows={6}
              className="font-mono text-sm"
            />
            <p className="text-[10px] text-muted-foreground">使用 {'{{variable}}'} 语法定义模板变量</p>
          </div>

          <div className="space-y-2">
            <Label>所需工具</Label>
            <div className="flex gap-2">
              <Input
                placeholder="输入工具名，如: git, node, npm"
                value={toolInput}
                onChange={(e) => setToolInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTool() } }}
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={addTool}>添加</Button>
            </div>
            {requiredTools.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {requiredTools.map((tool) => (
                  <Badge key={tool} variant="secondary" className="text-xs gap-1 pr-1">
                    {tool}
                    <button onClick={() => removeTool(tool)} className="hover:text-destructive transition-colors">
                      <span className="text-[10px]">×</span>
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill-criteria">验收标准</Label>
            <Textarea
              id="skill-criteria"
              placeholder="定义技能执行成功的标准..."
              value={acceptanceCriteria}
              onChange={(e) => setAcceptanceCriteria(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>适用场景</Label>
            <Select value={scene} onValueChange={setScene}>
              <SelectTrigger>
                <SelectValue placeholder="选择场景" />
              </SelectTrigger>
              <SelectContent>
                {SCENE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-1.5">
                      {opt.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={createSkill.isPending}>
            {createSkill.isPending ? '创建中...' : '创建 Skill'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ Edit Skill Dialog ============

function EditSkillDialog({
  skill,
  open,
  onOpenChange,
}: {
  skill: Skill | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [promptTemplate, setPromptTemplate] = useState('')
  const [toolInput, setToolInput] = useState('')
  const [requiredTools, setRequiredTools] = useState<string[]>([])
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('')
  const [scene, setScene] = useState('')
  const updateSkill = useUpdateSkill()

  // Populate form when skill changes
  const handleOpen = (isOpen: boolean) => {
    if (isOpen && skill) {
      setName(skill.name)
      setDescription(skill.description)
      setPromptTemplate(skill.promptTemplate)
      setRequiredTools(parseJsonField<string[]>(skill.requiredTools, []))
      setAcceptanceCriteria(skill.acceptanceCriteria || '')
      setScene(skill.scene || '')
    }
    onOpenChange(isOpen)
  }

  const addTool = () => {
    const tool = toolInput.trim()
    if (tool && !requiredTools.includes(tool)) {
      setRequiredTools([...requiredTools, tool])
      setToolInput('')
    }
  }

  const removeTool = (tool: string) => {
    setRequiredTools(requiredTools.filter(t => t !== tool))
  }

  const handleSubmit = async () => {
    if (!skill) return
    try {
      await updateSkill.mutateAsync({
        id: skill.id,
        data: {
          name: name.trim(),
          description: description.trim(),
          promptTemplate: promptTemplate.trim(),
          requiredTools,
          acceptanceCriteria: acceptanceCriteria.trim() || undefined,
          scene: scene || undefined,
        },
      })
      toast.success('技能已更新')
      onOpenChange(false)
    } catch (error) {
      toast.error(`更新失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="size-5 text-primary" />
            编辑 Skill
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-name">名称</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-desc">描述</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-prompt">Prompt 模板</Label>
            <Textarea value={promptTemplate} onChange={(e) => setPromptTemplate(e.target.value)} rows={6} className="font-mono text-sm" />
          </div>
          <div className="space-y-2">
            <Label>所需工具</Label>
            <div className="flex gap-2">
              <Input
                placeholder="输入工具名"
                value={toolInput}
                onChange={(e) => setToolInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTool() } }}
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={addTool}>添加</Button>
            </div>
            {requiredTools.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {requiredTools.map((tool) => (
                  <Badge key={tool} variant="secondary" className="text-xs gap-1 pr-1">
                    {tool}
                    <button onClick={() => removeTool(tool)} className="hover:text-destructive transition-colors">
                      <span className="text-[10px]">×</span>
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-criteria">验收标准</Label>
            <Textarea value={acceptanceCriteria} onChange={(e) => setAcceptanceCriteria(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>适用场景</Label>
            <Select value={scene} onValueChange={setScene}>
              <SelectTrigger>
                <SelectValue placeholder="选择场景" />
              </SelectTrigger>
              <SelectContent>
                {SCENE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={updateSkill.isPending}>
            {updateSkill.isPending ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ Main Component ============

export function SkillsView() {
  const [createOpen, setCreateOpen] = useState(false)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null)
  const [sceneFilter, setSceneFilter] = useState<string>('all')

  const { data: skills, isLoading } = useSkills(sceneFilter !== 'all' ? { scene: sceneFilter } : undefined)
  const createSkill = useCreateSkill()
  const deleteSkill = useDeleteSkill()

  const filteredSkills = useMemo(() => {
    if (!skills) return []
    return skills
  }, [skills])

  const handleCreateDefaults = async () => {
    try {
      for (const skillDef of DEFAULT_SKILLS) {
        await createSkill.mutateAsync({
          name: skillDef.name,
          description: skillDef.description,
          promptTemplate: skillDef.promptTemplate,
          requiredTools: skillDef.requiredTools,
          acceptanceCriteria: skillDef.acceptanceCriteria,
          scene: skillDef.scene,
          isBuiltIn: skillDef.isBuiltIn,
        })
      }
      toast.success('默认技能创建成功！')
    } catch (error) {
      toast.error(`创建失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteSkill.mutateAsync(deleteTarget.id)
      toast.success(`技能 "${deleteTarget.name}" 已删除`)
      setDeleteTarget(null)
    } catch (error) {
      toast.error(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  const handleEdit = (skill: Skill) => {
    setEditingSkill(skill)
    setEditOpen(true)
  }

  return (
    <div className="space-y-6 p-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="size-6 text-primary" />
            Skills
          </h1>
          <p className="text-muted-foreground mt-1">管理和配置 Agent 技能模板</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={sceneFilter} onValueChange={setSceneFilter}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue placeholder="场景" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部场景</SelectItem>
              {SCENE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            创建 Skill
          </Button>
        </div>
      </div>

      {/* Skills Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <Skeleton className="size-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredSkills.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {filteredSkills.map((skill, i) => {
              const tools = parseJsonField<string[]>(skill.requiredTools, [])
              const sceneOption = SCENE_OPTIONS.find(s => s.value === skill.scene)
              const boundAgents = skill._count?.agentSkills ?? skill.agentSkills?.length ?? 0
              const colorClass = getSkillColor(skill.name)

              return (
                <motion.div
                  key={skill.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="group hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={`flex size-10 items-center justify-center rounded-lg shrink-0 ${colorClass}`}>
                          <Zap className="size-5" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm truncate">{skill.name}</h3>
                            {skill.isBuiltIn && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-primary/10 text-primary">
                                内置
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{skill.description}</p>

                          {/* Scene + Version + Usage */}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {sceneOption && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5">
                                {sceneOption.label}
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground">v{skill.version}</span>
                            <span className="text-[10px] text-muted-foreground">· 使用 {skill.usageCount} 次</span>
                            {boundAgents > 0 && (
                              <span className="text-[10px] text-muted-foreground">· {boundAgents} Agent</span>
                            )}
                          </div>

                          {/* Tools */}
                          {tools.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {tools.map((tool) => (
                                <Badge key={tool} variant="secondary" className="text-[10px] h-4 px-1">
                                  {tool}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end gap-1 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => handleEdit(skill)}>
                          <Edit3 className="size-3" />
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(skill)}
                        >
                          <Trash2 className="size-3" />
                          删除
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
                <BookOpen className="size-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-medium mb-1">还没有 Skill</h3>
              <p className="text-sm text-muted-foreground mb-4">
                创建技能模板，让 Agent 更高效地执行任务
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button variant="outline" className="gap-2" onClick={() => setCreateOpen(true)}>
                  <Plus className="size-4" />
                  手动创建
                </Button>
                <Button className="gap-2" onClick={handleCreateDefaults} disabled={createSkill.isPending}>
                  <Zap className="size-4" />
                  {createSkill.isPending ? '创建中...' : '创建默认技能'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <CreateSkillDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Edit Dialog */}
      <EditSkillDialog skill={editingSkill} open={editOpen} onOpenChange={setEditOpen} />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除技能 &quot;{deleteTarget?.name}&quot; 吗？此操作不可撤销，已绑定此技能的Agent将被解除绑定。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
