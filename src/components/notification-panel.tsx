'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, Check, CheckCheck, Trash2, Filter,
  MessageSquare, GitBranch, Bot, AlertCircle,
  Lightbulb, Zap, Activity,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useAuditLogs, type AuditLog } from '@/lib/hooks'

// ============ Notification Item ============

function getNotificationIcon(action: string, actorType: string) {
  if (action.includes('issue') || action.includes('Issue')) return MessageSquare
  if (action.includes('status') || action.includes('assign')) return GitBranch
  if (action.includes('agent') || action.includes('Agent')) return Bot
  if (action.includes('inspiration') || action.includes('Inspiration')) return Lightbulb
  if (action.includes('skill') || action.includes('Skill')) return Zap
  if (action.includes('daemon') || action.includes('Daemon')) return Activity
  if (action.includes('comment') || action.includes('Comment')) return MessageSquare
  return AlertCircle
}

function getNotificationColor(actorType: string) {
  switch (actorType) {
    case 'agent': return 'text-emerald-500 bg-emerald-500/10'
    case 'human': return 'text-blue-500 bg-blue-500/10'
    case 'system': return 'text-amber-500 bg-amber-500/10'
    default: return 'text-gray-500 bg-gray-500/10'
  }
}

function formatActionLabel(action: string): string {
  const labels: Record<string, string> = {
    'create_issue': '创建了任务',
    'change_status': '变更了状态',
    'assign_issue': '指派了任务',
    'add_comment': '添加了评论',
    'analyze_inspiration': '分析了灵感',
    'create_issues_from_inspiration': '从灵感创建了任务',
    'register_agent': '注册了Agent',
    'update_agent': '更新了Agent',
    'register_daemon': '注册了Daemon',
    'heartbeat': 'Daemon心跳',
  }
  return labels[action] || action
}

function formatTargetType(type: string): string {
  const labels: Record<string, string> = {
    'issue': '任务',
    'comment': '评论',
    'session': '会话',
    'member': '成员',
    'daemon': 'Daemon',
    'skill': '技能',
    'inspiration': '灵感',
  }
  return labels[type] || type
}

function getRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

interface NotificationItemProps {
  log: AuditLog
  isRead: boolean
  onMarkRead: (id: string) => void
}

function NotificationItem({ log, isRead, onMarkRead }: NotificationItemProps) {
  const colorClass = getNotificationColor(log.actorType)
  const iconType = getNotificationIcon(log.action, log.actorType)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className={`
        relative flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer
        transition-colors group
        ${isRead ? 'hover:bg-muted/50' : 'bg-primary/5 hover:bg-primary/10'}
      `}
      onClick={() => onMarkRead(log.id)}
    >
      {/* Unread dot */}
      {!isRead && (
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-primary" />
      )}

      {/* Icon */}
      <div className={`shrink-0 flex size-7 items-center justify-center rounded-full ${colorClass}`}>
        {React.createElement(iconType, { className: 'size-3.5' })}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs leading-relaxed">
          <span className="font-medium">{log.actor?.name || 'System'}</span>
          {' '}
          <span className="text-muted-foreground">{formatActionLabel(log.action)}</span>
          {log.targetType && (
            <span className="text-muted-foreground">
              {' '}
              <span className="text-primary/70">{formatTargetType(log.targetType)}</span>
            </span>
          )}
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
          {getRelativeTime(log.createdAt)}
        </p>
      </div>

      {/* Hover actions */}
      <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isRead && (
          <Button variant="ghost" size="icon" className="size-5" onClick={(e) => { e.stopPropagation(); onMarkRead(log.id) }}>
            <Check className="size-3" />
          </Button>
        )}
      </div>
    </motion.div>
  )
}

// ============ Main Notification Panel ============

export function NotificationPanel() {
  const [open, setOpen] = useState(false)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [filterType, setFilterType] = useState<string>('all')

  const { data: auditData, isLoading, refetch } = useAuditLogs({ limit: 30 })

  const notifications = useMemo(() => {
    if (!auditData?.data) return []
    let logs = auditData.data
    if (filterType !== 'all') {
      logs = logs.filter(l => l.actorType === filterType)
    }
    return logs
  }, [auditData, filterType])

  const unreadCount = useMemo(() => {
    if (!auditData?.data) return 0
    return auditData.data.filter(l => !readIds.has(l.id)).length
  }, [auditData, readIds])

  const handleMarkRead = (id: string) => {
    setReadIds(prev => new Set([...prev, id]))
  }

  const handleMarkAllRead = () => {
    if (!auditData?.data) return
    setReadIds(new Set(auditData.data.map(l => l.id)))
  }

  const handleClearAll = () => {
    setReadIds(new Set())
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 relative">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 gap-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">通知</h4>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {unreadCount} 未读
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-1.5" onClick={handleMarkAllRead}>
                <CheckCheck className="size-3" />
                全部已读
              </Button>
            )}
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/30">
          <Filter className="size-3 text-muted-foreground" />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-6 text-[10px] w-24 border-0 bg-transparent p-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="agent">Agent</SelectItem>
              <SelectItem value="human">人类</SelectItem>
              <SelectItem value="system">系统</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="size-5 ml-auto" onClick={() => refetch()}>
            <Activity className="size-3" />
          </Button>
        </div>

        {/* List */}
        <ScrollArea className="h-[360px]">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="size-7 rounded-full shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-2 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length > 0 ? (
            <div className="p-1.5 space-y-0.5">
              <AnimatePresence>
                {notifications.map((log) => (
                  <NotificationItem
                    key={log.id}
                    log={log}
                    isRead={readIds.has(log.id)}
                    onMarkRead={handleMarkRead}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="size-8 mb-2 opacity-30" />
              <p className="text-sm">暂无通知</p>
              <p className="text-xs mt-1 opacity-60">当有新活动时，通知将出现在这里</p>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t px-3 py-2 flex justify-between items-center">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] gap-1"
            onClick={handleClearAll}
          >
            <Trash2 className="size-3" />
            清除已读
          </Button>
          <span className="text-[10px] text-muted-foreground">
            共 {notifications.length} 条
          </span>
        </div>
      </PopoverContent>
    </Popover>
  )
}
