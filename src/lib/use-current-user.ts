// AgentTeam 协作平台 - Current User Hook
// 管理默认用户创建和 localStorage 持久化

'use client'

import { useEffect, useState, useCallback } from 'react'
import { membersApi, type Member } from '@/lib/api'

const STORAGE_KEY = 'agentteam-current-user-id'

export function useCurrentUser() {
  const [user, setUser] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)

  const initUser = useCallback(async () => {
    try {
      setLoading(true)
      const storedId = typeof window !== 'undefined'
        ? localStorage.getItem(STORAGE_KEY)
        : null

      if (storedId) {
        try {
          const member = await membersApi.get(storedId)
          if (member && member.type === 'human') {
            setUser(member)
            return
          }
        } catch {
          // Stored user not found, create new one
        }
      }

      // Try to find existing human member
      const humans = await membersApi.list({ type: 'human' })
      if (humans.length > 0) {
        const firstHuman = humans[0]
        setUser(firstHuman)
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, firstHuman.id)
        }
        return
      }

      // Create default human member
      const newMember = await membersApi.create({
        type: 'human',
        name: '用户',
        role: 'admin',
        avatar: '',
      })
      setUser(newMember)
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, newMember.id)
      }
    } catch (error) {
      console.error('Failed to initialize current user:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    initUser()
  }, [initUser])

  const updateUser = useCallback(async (data: { name?: string; avatar?: string }) => {
    if (!user) return
    try {
      const updated = await membersApi.update(user.id, data)
      setUser(updated)
    } catch (error) {
      console.error('Failed to update user:', error)
    }
  }, [user])

  return { user, userId: user?.id ?? null, loading, updateUser, refetch: initUser }
}
