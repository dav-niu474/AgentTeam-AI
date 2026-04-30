'use client'

import { useQuery } from '@tanstack/react-query'

// ============ Types ============

export interface Notification {
  id: string
  actorId: string
  actorName: string
  actorType: string
  actorAvatar: string | null
  action: string
  targetType: string
  targetId: string
  description: string
  iconType: string
  details: Record<string, unknown>
  read: boolean
  createdAt: string
}

export interface NotificationsResponse {
  notifications: Notification[]
  unreadCount: number
  total: number
}

// ============ LocalStorage helpers for read tracking ============

const READ_IDS_KEY = 'agentteam-read-notification-ids'

function getReadIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const stored = localStorage.getItem(READ_IDS_KEY)
    if (!stored) return new Set()
    return new Set(JSON.parse(stored) as string[])
  } catch {
    return new Set()
  }
}

function setReadIds(ids: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    // Only keep last 500 IDs to avoid overflow
    const arr = Array.from(ids).slice(-500)
    localStorage.setItem(READ_IDS_KEY, JSON.stringify(arr))
  } catch {
    // ignore storage errors
  }
}

export function markNotificationRead(id: string) {
  const ids = getReadIds()
  ids.add(id)
  setReadIds(ids)
}

export function markAllNotificationsRead(notificationIds: string[]) {
  const ids = getReadIds()
  notificationIds.forEach((id) => ids.add(id))
  setReadIds(ids)
}

export function getUnreadIds(allIds: string[]): string[] {
  const readIds = getReadIds()
  return allIds.filter((id) => !readIds.has(id))
}

// ============ Hook ============

export function useNotifications(limit = 50) {
  return useQuery({
    queryKey: ['notifications', limit],
    queryFn: async () => {
      // Get unread IDs from localStorage to pass to API
      const readIds = getReadIds()
      // We need to get all notification IDs first to determine which are unread
      // But since we track read status client-side, we'll fetch all and filter
      const res = await fetch(`/api/notifications?limit=${limit}`)
      if (!res.ok) {
        throw new Error('Failed to fetch notifications')
      }
      const data = await res.json() as Omit<NotificationsResponse, 'notifications'> & {
        notifications: Array<Omit<Notification, 'read'> & { read?: boolean }>
      }

      // Apply client-side read tracking
      const notifications: Notification[] = data.notifications.map((n) => ({
        ...n,
        read: readIds.has(n.id) || !!n.read,
      }))

      const unreadCount = notifications.filter((n) => !n.read).length

      return {
        notifications,
        unreadCount,
        total: data.total,
      } as NotificationsResponse
    },
    refetchInterval: 30000, // Refetch every 30s
    refetchOnWindowFocus: true,
  })
}
