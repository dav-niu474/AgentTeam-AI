'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command'
import {
  LayoutDashboard,
  Kanban,
  Bot,
  Activity,
  Zap,
  Settings,
  Sparkles,
  Plus,
  ListTodo,
  Search,
  Lightbulb,
  Terminal,
} from 'lucide-react'
import { useAppStore, type ActiveView } from '@/lib/store'
import { useIssues, useAgents, useSkills, useInspirations } from '@/lib/hooks'

const NAV_ITEMS: { id: ActiveView; label: string; icon: React.ElementType; keywords: string[] }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, keywords: ['仪表盘', '总览', 'dashboard'] },
  { id: 'board', label: 'Board', icon: Kanban, keywords: ['看板', '任务', 'board', 'kanban'] },
  { id: 'inspirations', label: 'Inspirations', icon: Lightbulb, keywords: ['灵感', 'inspiration'] },
  { id: 'agents', label: 'Agents', icon: Bot, keywords: ['代理', '智能体', 'agent'] },
  { id: 'monitor', label: 'Monitor', icon: Activity, keywords: ['监控', '日志', 'monitor'] },
  { id: 'sessions', label: 'Sessions', icon: Terminal, keywords: ['会话', 'session', '终端'] },
  { id: 'skills', label: 'Skills', icon: Zap, keywords: ['技能', 'skill'] },
  { id: 'settings', label: 'Settings', icon: Settings, keywords: ['设置', 'setting'] },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const { setActiveView, setShowInspirationInput } = useAppStore()
  const { data: issues } = useIssues()
  const { data: agents } = useAgents()
  const { data: skills } = useSkills()
  const { data: inspirations } = useInspirations()

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSelect = useCallback((callback: () => void) => {
    setOpen(false)
    callback()
  }, [])

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="命令面板"
      description="搜索命令、任务、Agent..."
    >
      <CommandInput placeholder="搜索命令、任务、Agent、技能..." />
      <CommandList>
        <CommandEmpty>未找到结果</CommandEmpty>

        {/* Quick Actions */}
        <CommandGroup heading="快速操作">
          <CommandItem onSelect={() => handleSelect(() => setShowInspirationInput(true))}>
            <Sparkles className="size-4 text-primary" />
            <span>表达想法</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => setActiveView('board'))}>
            <Plus className="size-4" />
            <span>新建 Issue</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => setActiveView('agents'))}>
            <Bot className="size-4" />
            <span>注册 Agent</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => setActiveView('skills'))}>
            <Zap className="size-4" />
            <span>创建技能</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Navigation */}
        <CommandGroup heading="导航">
          {NAV_ITEMS.map((item) => (
            <CommandItem
              key={item.id}
              keywords={item.keywords}
              onSelect={() => handleSelect(() => setActiveView(item.id))}
            >
              <item.icon className="size-4" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Issues */}
        {issues && issues.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="任务">
              {issues.slice(0, 8).map((issue) => (
                <CommandItem
                  key={issue.id}
                  keywords={[issue.title, issue.status, issue.priority]}
                  onSelect={() => handleSelect(() => {
                    setActiveView('board')
                    useAppStore.getState().setSelectedIssueId(issue.id)
                  })}
                >
                  <ListTodo className="size-4" />
                  <span className="truncate">{issue.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {issue.status === 'open' ? '待处理' : issue.status === 'in_progress' ? '进行中' : issue.status === 'in_review' ? '待审查' : issue.status === 'resolved' ? '已解决' : issue.status}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Agents */}
        {agents && agents.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Agent">
              {agents.slice(0, 6).map((agent) => (
                <CommandItem
                  key={agent.id}
                  keywords={[agent.name]}
                  onSelect={() => handleSelect(() => setActiveView('agents'))}
                >
                  <Bot className="size-4" />
                  <span>{agent.name}</span>
                  <span className={`ml-auto size-2 rounded-full ${agent.agentStatus === 'online' ? 'bg-emerald-500' : agent.agentStatus === 'busy' ? 'bg-amber-500' : 'bg-gray-400'}`} />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Skills */}
        {skills && skills.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="技能">
              {skills.slice(0, 6).map((skill) => (
                <CommandItem
                  key={skill.id}
                  keywords={[skill.name, skill.scene || '']}
                  onSelect={() => handleSelect(() => setActiveView('skills'))}
                >
                  <Zap className="size-4" />
                  <span>{skill.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Inspirations */}
        {inspirations && inspirations.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="灵感">
              {inspirations.slice(0, 5).map((insp) => (
                <CommandItem
                  key={insp.id}
                  keywords={[insp.content, insp.status]}
                  onSelect={() => handleSelect(() => setActiveView('inspirations'))}
                >
                  <Lightbulb className="size-4" />
                  <span className="truncate">{insp.content}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
