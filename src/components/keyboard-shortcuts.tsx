'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Keyboard, Navigation, Zap, Eye } from 'lucide-react'

type ActiveView = 'dashboard' | 'board' | 'inspirations' | 'agents' | 'monitor' | 'sessions' | 'skills' | 'settings'

const VIEW_SHORTCUTS: { key: string; view: ActiveView; label: string }[] = [
  { key: '1', view: 'dashboard', label: '仪表盘' },
  { key: '2', view: 'board', label: '看板' },
  { key: '3', view: 'inspirations', label: '灵感' },
  { key: '4', view: 'agents', label: 'Agents' },
  { key: '5', view: 'monitor', label: '监控' },
  { key: '6', view: 'sessions', label: '会话' },
  { key: '7', view: 'skills', label: '技能' },
  { key: '8', view: 'settings', label: '设置' },
]

const ACTION_SHORTCUTS = [
  { keys: ['⌘', 'K'], label: '命令面板', description: '全局搜索和快捷操作' },
  { keys: ['⌘', 'I'], label: '表达想法', description: '快速输入灵感' },
  { keys: ['⌘', 'N'], label: '新建 Issue', description: '创建新任务' },
  { keys: ['?'], label: '快捷键帮助', description: '显示此帮助面板' },
  { keys: ['Esc'], label: '关闭/返回', description: '关闭当前弹窗' },
]

const NAVIGATION_SHORTCUTS = VIEW_SHORTCUTS.map(s => ({
  keys: ['⌘', s.key],
  label: s.label,
  description: `切换到${s.label}视图`,
}))

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md border border-border bg-muted/80 text-[11px] font-mono font-medium text-muted-foreground shadow-sm">
      {children}
    </kbd>
  )
}

function ShortcutGroup({
  icon: Icon,
  title,
  shortcuts,
}: {
  icon: React.ElementType
  title: string
  shortcuts: { keys: string[]; label: string; description: string }[]
}) {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
        <Icon className="size-3.5" />
        {title}
      </h3>
      <div className="space-y-1.5">
        {shortcuts.map((shortcut) => (
          <div
            key={shortcut.label}
            className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{shortcut.label}</span>
              <span className="text-xs text-muted-foreground">{shortcut.description}</span>
            </div>
            <div className="flex items-center gap-0.5">
              {shortcut.keys.map((key, i) => (
                <span key={i} className="flex items-center gap-0.5">
                  {i > 0 && <span className="text-muted-foreground/50 text-[10px]">+</span>}
                  <Kbd>{key}</Kbd>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function KeyboardShortcutsHelp({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="size-5 text-primary" />
            键盘快捷键
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <ShortcutGroup icon={Navigation} title="导航" shortcuts={NAVIGATION_SHORTCUTS} />
          <ShortcutGroup icon={Zap} title="操作" shortcuts={ACTION_SHORTCUTS} />
        </div>
        <div className="pt-2 border-t">
          <p className="text-[11px] text-muted-foreground text-center">
            按 <Kbd>?</Kbd> 随时打开此帮助面板
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function useKeyboardShortcuts(
  setActiveView: (view: ActiveView) => void,
  openCommandPalette?: () => void,
  openInspirationInput?: () => void,
) {
  const [helpOpen, setHelpOpen] = useState(false)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey

      // Cmd+1-8: Switch views
      if (isMeta && e.key >= '1' && e.key <= '8') {
        e.preventDefault()
        const idx = parseInt(e.key, 10) - 1
        if (idx < VIEW_SHORTCUTS.length) {
          setActiveView(VIEW_SHORTCUTS[idx].view)
        }
        return
      }

      // ?: Open help (only when not in input)
      if (
        e.key === '?' &&
        !isMeta &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault()
        setHelpOpen((prev) => !prev)
        return
      }

      // Cmd+I: Inspiration
      if (isMeta && e.key === 'i') {
        e.preventDefault()
        openInspirationInput?.()
        return
      }

      // Cmd+K is handled by command-palette component
    },
    [setActiveView, openCommandPalette, openInspirationInput],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return { helpOpen, setHelpOpen }
}
