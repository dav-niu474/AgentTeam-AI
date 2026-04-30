'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  Bell,
  CheckCheck,
  PlusCircle,
  ArrowRightLeft,
  UserPlus,
  Trash2,
  Sparkles,
  Zap,
  Info,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useNotifications, markNotificationRead, markAllNotificationsRead } from '@/hooks/use-notifications'
import type { Notification } from '@/hooks/use-notifications'
import { useQueryClient } from '@tanstack/react-query'

// ============ Icon mapping ============

const ICON_MAP: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  create: { icon: PlusCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  change: { icon: ArrowRightLeft, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  assign: { icon: UserPlus, color: 'text-teal-500', bg: 'bg-teal-500/10' },
  delete: { icon: Trash2, color: 'text-red-500', bg: 'bg-red-500/10' },
  analyze: { icon: Sparkles, color: 'text-violet-500', bg: 'bg-violet-500/10' },
  execute: { icon: Zap, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10' },
}

// ============ Single Notification Item ============

function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification
  onRead: (id: string) => void
}) {
  const iconConfig = ICON_MAP[notification.iconType] || ICON_MAP.info
  const Icon = iconConfig.icon

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`
        flex items-start gap-3 p-3 cursor-pointer transition-colors rounded-md
        hover:bg-accent/50
        ${!notification.read ? 'bg-primary/5 border-l-2 border-l-primary' : ''}
      `}
      onClick={() => {
        if (!notification.read) {
          onRead(notification.id)
        }
      }}
    >
      {/* Icon */}
      <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${iconConfig.bg}`}>
        <Icon className={`size-4 ${iconConfig.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${!notification.read ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
          {notification.description}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: zhCN })}
        </p>
      </div>

      {/* Unread dot */}
      {!notification.read && (
        <div className="size-2 rounded-full bg-primary shrink-0 mt-1.5" />
      )}
    </motion.div>
  )
}

// ============ Main Notification Panel ============

export function NotificationPanel() {
  const [open, setOpen] = useState(false)
  const { data, isLoading } = useNotifications(50)
  const queryClient = useQueryClient()

  const notifications = data?.notifications || []
  const unreadCount = data?.unreadCount || 0

  const handleRead = (id: string) => {
    markNotificationRead(id)
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  const handleMarkAllRead = () => {
    const allIds = notifications.map((n) => n.id)
    markAllNotificationsRead(allIds)
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 relative hover:bg-accent/80 transition-colors">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96 p-0" align="end" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">通知中心</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <>
                <span className="text-xs text-muted-foreground">{unreadCount} 条未读</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1 px-2"
                  onClick={handleMarkAllRead}
                >
                  <CheckCheck className="size-3" />
                  全部已读
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Notification List */}
        <ScrollArea className="max-h-96">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="size-8 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
                    <div className="h-2 bg-muted rounded animate-pulse w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length > 0 ? (
            <div className="py-1">
              <AnimatePresence>
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onRead={handleRead}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="size-10 mb-3 opacity-20" />
              <p className="text-sm">暂无通知</p>
              <p className="text-xs mt-1 opacity-60">系统事件将在这里显示</p>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-2 text-center">
              <p className="text-[10px] text-muted-foreground">
                共 {notifications.length} 条通知
              </p>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
