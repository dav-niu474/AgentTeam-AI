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
import { AgentsView } from '@/components/views/agents-view'
import { MonitorView } from '@/components/views/monitor-view'
import { SkillsView } from '@/components/views/skills-view'
import { SettingsView } from '@/components/views/settings-view'
import { InspirationQuickInput } from '@/components/inspiration-quick-input'
import { useRealtime } from '@/hooks/use-realtime'

const navItems: { id: ActiveView; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'board', label: 'Board', icon: Kanban },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'monitor', label: 'Monitor', icon: Activity },
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
          className="size-8"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>切换{theme === 'dark' ? '亮色' : '暗色'}模式</p>
      </TooltipContent>
    </Tooltip>
  )
}

function HeaderBar({ onMobileMenuToggle }: { onMobileMenuToggle: () => void }) {
  const { setShowInspirationInput } = useAppStore()

  return (
    <header className="h-14 border-b border-border/50 bg-background/80 glass-effect flex items-center px-4 gap-4 z-30">
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
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Bot className="size-4" />
          </div>
          <span className="font-semibold text-sm tracking-tight hidden sm:inline">
            AgentTeam
          </span>
        </div>
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-md mx-auto">
        <div
          className="relative cursor-pointer"
          onClick={() => {/* Future: open command palette */}}
        >
          <div className="flex items-center h-8 w-full rounded-md border border-border/50 bg-muted/50 px-3 text-muted-foreground text-sm hover:bg-muted transition-colors">
            <Search className="size-3.5 mr-2 shrink-0" />
            <span className="flex-1">搜索...</span>
            <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border/50 bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
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
              className="size-8"
              onClick={() => setShowInspirationInput(true)}
            >
              <Sparkles className="size-4 text-primary" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>表达想法 (⌘I)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 relative">
              <Bell className="size-4" />
              <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>通知</p>
          </TooltipContent>
        </Tooltip>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 rounded-full">
              <Avatar className="size-7">
                <AvatarImage src="" alt="User" />
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  U
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
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
        {navItems.map((item) => {
          const isActive = activeView === item.id
          const Icon = item.icon
          return (
            <Tooltip key={item.id} delayDuration={collapsed ? 0 : 300}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleNavClick(item.id)}
                  className={`
                    w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium
                    transition-all duration-150
                    ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }
                    ${collapsed ? 'justify-center px-2' : ''}
                  `}
                >
                  <Icon className={`size-4 shrink-0 ${isActive ? 'text-primary' : ''}`} />
                  {!collapsed && <span>{item.label}</span>}
                  {isActive && !collapsed && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="ml-auto size-1.5 rounded-full bg-primary"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                </button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right">
                  <p>{item.label}</p>
                </TooltipContent>
              )}
            </Tooltip>
          )
        })}
      </nav>

      {/* Bottom Section */}
      <div className="px-2 pb-3 space-y-2">
        <Separator className="mb-2" />

        {/* Daemon Status */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground ${collapsed ? 'justify-center' : ''}`}
        >
          <span
            className={`size-2 rounded-full shrink-0 ${
              daemonOnline
                ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                : 'bg-red-500'
            }`}
          />
          {!collapsed && <span>Daemon: {daemonOnline ? 'Online' : 'Offline'}</span>}
        </div>

        {/* Quick Inspiration Button */}
        <Button
          variant="ghost"
          className={`w-full gap-2 text-primary hover:text-primary hover:bg-primary/10 ${
            collapsed ? 'justify-center px-2' : ''
          }`}
          onClick={() => setShowInspirationInput(true)}
        >
          <Sparkles className="size-4 shrink-0" />
          {!collapsed && <span>表达想法</span>}
        </Button>
      </div>
    </div>
  )
}

function FooterBar() {
  const { daemonOnline } = useAppStore()

  return (
    <footer className="h-8 border-t border-border/50 bg-background/80 glass-effect flex items-center justify-between px-4 text-xs text-muted-foreground z-30">
      <div className="flex items-center gap-2">
        <span
          className={`size-1.5 rounded-full ${
            daemonOnline
              ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]'
              : 'bg-red-500'
          }`}
        />
        <span>Daemon: {daemonOnline ? 'Online' : 'Offline'}</span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
          MVP
        </Badge>
        <span>AgentTeam v0.1.0</span>
      </div>
    </footer>
  )
}

function ViewRenderer() {
  const { activeView } = useAppStore()

  const views: Record<ActiveView, React.ReactNode> = {
    dashboard: <DashboardView />,
    board: <BoardView />,
    agents: <AgentsView />,
    monitor: <MonitorView />,
    skills: <SkillsView />,
    settings: <SettingsView />,
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeView}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15 }}
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

  // Enable real-time WebSocket updates for the entire app
  useRealtime()

  // Keyboard shortcut for inspiration input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault()
        useAppStore.getState().setShowInspirationInput(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <HeaderBar onMobileMenuToggle={() => setMobileMenuOpen(true)} />

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
                  className="size-7"
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
              <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Bot className="size-4" />
              </div>
              <span className="font-semibold text-sm">AgentTeam</span>
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
    </div>
  )
}
