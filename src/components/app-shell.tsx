'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard,
  Kanban,
  Bot,
  Activity,
  Zap,
  Settings,
  Search,
  Bell,
  Sun,
  Moon,
  Sparkles,
  ChevronLeft,
  Menu,
  Command,
  LogOut,
  User,
  Lightbulb,
  Terminal,
  Keyboard,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { useAppStore, type ActiveView } from '@/lib/store'
import { DashboardView } from '@/components/views/dashboard-view'
import { BoardView } from '@/components/views/board-view'
import { InspirationsView } from '@/components/views/inspirations-view'
import { AgentsView } from '@/components/views/agents-view'
import { MonitorView } from '@/components/views/monitor-view'
import { SkillsView } from '@/components/views/skills-view'
import { SettingsView } from '@/components/views/settings-view'
import { SessionsView } from '@/components/views/sessions-view'
import { InspirationQuickInput } from '@/components/inspiration-quick-input'
import { CommandPalette } from '@/components/command-palette'
import { NotificationPanel } from '@/components/notification-panel'
import { KeyboardShortcutsHelp, useKeyboardShortcuts } from '@/components/keyboard-shortcuts'
import { useRealtime } from '@/hooks/use-realtime'

const navItems: { id: ActiveView; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'board', label: 'Board', icon: Kanban },
  { id: 'inspirations', label: 'Inspirations', icon: Lightbulb },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'monitor', label: 'Monitor', icon: Activity },
  { id: 'sessions', label: 'Sessions', icon: Terminal },
  { id: 'skills', label: 'Skills', icon: Zap },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const emptySubscribe = () => () => {}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="size-8">
        <Sun className="size-4" />
      </Button>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 hover:bg-accent/80 transition-colors"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <motion.div
            initial={false}
            animate={{ rotate: theme === 'dark' ? 180 : 0, scale: theme === 'dark' ? 0.9 : 1 }}
            transition={{ duration: 0.3, type: 'spring', stiffness: 200 }}
          >
            {theme === 'dark' ? (
              <Sun className="size-4 text-amber-500" />
            ) : (
              <Moon className="size-4 text-slate-600" />
            )}
          </motion.div>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>切换{theme === 'dark' ? '亮色' : '暗色'}模式</p>
      </TooltipContent>
    </Tooltip>
  )
}

function HeaderBar({ onMobileMenuToggle, onCommandPaletteToggle, onShortcutsToggle }: { onMobileMenuToggle: () => void; onCommandPaletteToggle: () => void; onShortcutsToggle: () => void }) {
  const { setShowInspirationInput } = useAppStore()

  return (
    <header className="h-14 bg-background/80 glass-effect flex items-center px-4 gap-4 z-30 header-gradient-border">
      {/* Left: Mobile menu + Logo */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 md:hidden"
          onClick={onMobileMenuToggle}
        >
          <Menu className="size-4" />
        </Button>
        <div className="flex items-center gap-2">
          <motion.div
            className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/80 shadow-sm"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Bot className="size-4 text-primary-foreground" />
          </motion.div>
          <span className="font-semibold text-sm tracking-tight hidden sm:inline gradient-text">
            AgentTeam
          </span>
        </div>
      </div>

      {/* Center: Search / Command Palette trigger */}
      <div className="flex-1 max-w-md mx-auto">
        <div
          className="relative cursor-pointer group"
          onClick={onCommandPaletteToggle}
        >
          <div className="flex items-center h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-muted-foreground text-sm hover:border-primary/40 hover:shadow-sm focus-within:border-primary/50 focus-within:shadow-sm focus-within:ring-1 focus-within:ring-primary/20 transition-all duration-200">
            <Search className="size-3.5 mr-2 shrink-0 text-muted-foreground/60 group-hover:text-primary/70 transition-colors" />
            <span className="flex-1">搜索任务、Agent、技能...</span>
            <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border/50 bg-muted/80 px-1.5 font-mono text-[10px] font-medium text-muted-foreground group-hover:border-primary/30 group-hover:text-primary/60 transition-colors">
              <Command className="size-2.5" />K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 hover:bg-primary/10 transition-colors"
              onClick={() => setShowInspirationInput(true)}
            >
              <motion.div whileHover={{ rotate: 15 }} transition={{ type: 'spring', stiffness: 300 }}>
                <Sparkles className="size-4 text-primary" />
              </motion.div>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>表达想法 (⌘I)</p>
          </TooltipContent>
        </Tooltip>

        <div className="animate-bounce-subtle">
          <NotificationPanel />
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 hover:bg-accent/80 transition-colors"
              onClick={onShortcutsToggle}
            >
              <Keyboard className="size-4 text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>快捷键 (?)</p>
          </TooltipContent>
        </Tooltip>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 rounded-full hover:bg-accent/80 transition-colors">
              <Avatar className="size-7 ring-1 ring-border/50">
                <AvatarImage src="" alt="User" />
                <AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
                  U
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 animate-fade-slide-in">
            <DropdownMenuLabel>我的账户</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2">
              <User className="size-4" />
              个人资料
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-destructive">
              <LogOut className="size-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean
  onNavigate?: () => void
}) {
  const { activeView, setActiveView, daemonOnline, setShowInspirationInput } =
    useAppStore()

  const handleNavClick = (view: ActiveView) => {
    setActiveView(view)
    onNavigate?.()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Navigation Items */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map((navItem) => {
          const isActive = activeView === navItem.id
          const Icon = navItem.icon
          return (
            <Tooltip key={navItem.id} delayDuration={collapsed ? 0 : 300}>
              <TooltipTrigger asChild>
                <motion.button
                  onClick={() => handleNavClick(navItem.id)}
                  className={`
                    w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium
                    transition-all duration-200 relative
                    ${
                      isActive
                        ? 'bg-primary/10 text-primary scale-[1.02]'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-accent-foreground hover:scale-[1.02]'
                    }
                    ${collapsed ? 'justify-center px-2' : ''}
                  `}
                  whileHover={{ x: isActive ? 0 : 2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active-indicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <Icon className={`size-4 shrink-0 transition-colors ${isActive ? 'text-primary' : ''}`} />
                  {!collapsed && <span>{navItem.label}</span>}
                  {isActive && !collapsed && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="ml-auto size-1.5 rounded-full bg-primary"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                </motion.button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right">
                  <p>{navItem.label}</p>
                </TooltipContent>
              )}
            </Tooltip>
          )
        })}
      </nav>

      {/* Bottom Section */}
      <div className="px-2 pb-3 space-y-2">
        <Separator className="mb-2" />

        {/* Daemon Status with glow */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground ${collapsed ? 'justify-center' : ''}`}
        >
          <motion.span
            className={`size-2 rounded-full shrink-0 ${
              daemonOnline
                ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                : 'bg-red-500'
            }`}
            animate={daemonOnline ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          {!collapsed && <span>Daemon: {daemonOnline ? 'Online' : 'Offline'}</span>}
        </div>

        {/* Quick Inspiration Button */}
        <Button
          variant="ghost"
          className={`w-full gap-2 text-primary hover:text-primary hover:bg-primary/10 transition-all duration-200 ${
            collapsed ? 'justify-center px-2' : ''
          }`}
          onClick={() => setShowInspirationInput(true)}
        >
          <motion.div whileHover={{ rotate: 15 }} transition={{ type: 'spring', stiffness: 300 }}>
            <Sparkles className="size-4 shrink-0" />
          </motion.div>
          {!collapsed && <span>表达想法</span>}
        </Button>
      </div>
    </div>
  )
}

function FooterBar() {
  const { daemonOnline } = useAppStore()

  return (
    <footer className="h-8 bg-background/80 glass-effect flex items-center justify-between px-4 text-xs text-muted-foreground z-30 border-t border-border/30">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span
            className={`size-2 rounded-full ${
              daemonOnline
                ? 'bg-emerald-500 animate-pulse-soft shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                : 'bg-red-500'
            }`}
          />
          <span className={daemonOnline ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-red-500 font-medium'}>
            Daemon {daemonOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        <span className="text-border/50">|</span>
        <span className="hidden sm:inline">系统运行中</span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal border-primary/20 text-primary">
          MVP
        </Badge>
        <span className="font-medium">AgentTeam v0.1.0</span>
      </div>
    </footer>
  )
}

function ViewRenderer() {
  const { activeView } = useAppStore()

  const views: Record<ActiveView, React.ReactNode> = {
    dashboard: <DashboardView />,
    board: <BoardView />,
    inspirations: <InspirationsView />,
    agents: <AgentsView />,
    monitor: <MonitorView />,
    sessions: <SessionsView />,
    skills: <SkillsView />,
    settings: <SettingsView />,
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeView}
        initial={{ opacity: 0, scale: 0.98, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: -6 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="h-full overflow-auto"
      >
        {views[activeView]}
      </motion.div>
    </AnimatePresence>
  )
}

export function AppShell() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // Enable real-time WebSocket updates for the entire app
  useRealtime()

  // Keyboard shortcuts
  const { setActiveView } = useAppStore()
  const { helpOpen, setHelpOpen } = useKeyboardShortcuts(
    setActiveView,
    () => setCommandPaletteOpen((prev) => !prev),
    () => useAppStore.getState().setShowInspirationInput(true),
  )

  // Legacy keyboard shortcuts for Cmd+I and Cmd+K (handled by useKeyboardShortcuts now)
  useEffect(() => {
    // These are handled by useKeyboardShortcuts hook
    // keeping this for any additional shortcuts not covered
  }, [])

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <HeaderBar
        onMobileMenuToggle={() => setMobileMenuOpen(true)}
        onCommandPaletteToggle={() => setCommandPaletteOpen((prev) => !prev)}
        onShortcutsToggle={() => setHelpOpen((prev) => !prev)}
      />

      {/* Main area: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <motion.aside
          className="hidden md:flex flex-col border-r border-border/50 bg-sidebar text-sidebar-foreground overflow-hidden"
          animate={{ width: sidebarCollapsed ? 56 : 240 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
        >
          {/* Sidebar Header with collapse toggle */}
          <div className="h-10 flex items-center justify-end px-2 border-b border-border/50">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 hover:bg-accent/80 transition-colors"
                  onClick={toggleSidebar}
                >
                  <motion.div
                    animate={{ rotate: sidebarCollapsed ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronLeft className="size-4" />
                  </motion.div>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{sidebarCollapsed ? '展开侧栏' : '收起侧栏'}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <SidebarNav collapsed={sidebarCollapsed} />
        </motion.aside>

        {/* Mobile Sidebar */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">导航菜单</SheetTitle>
            <div className="h-14 flex items-center gap-2 px-4 border-b border-border/50">
              <div className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/80">
                <Bot className="size-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-sm gradient-text">AgentTeam</span>
            </div>
            <SidebarNav
              collapsed={false}
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden bg-background">
          <ViewRenderer />
        </main>
      </div>

      {/* Footer */}
      <FooterBar />

      {/* Inspiration Quick Input Dialog */}
      <InspirationQuickInput />

      {/* Command Palette */}
      <CommandPalette />

      {/* Shortcuts Help Dialog */}
      <KeyboardShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  )
}
