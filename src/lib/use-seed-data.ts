// AgentTeam 协作平台 - Seed Data Hook
// 首次访问时提供创建示例数据的引导

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

const SEEDED_KEY = 'agentteam-seeded'

export function useSeedData() {
  const [shouldPrompt, setShouldPrompt] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const alreadySeeded = localStorage.getItem(SEEDED_KEY)
    if (!alreadySeeded) {
      setShouldPrompt(true)
    }
  }, [])

  const seedData = useCallback(async () => {
    setSeeding(true)
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      if (!res.ok) throw new Error('Seed failed')
      const data = await res.json()
      localStorage.setItem(SEEDED_KEY, 'true')
      setShouldPrompt(false)
      await queryClient.invalidateQueries()
      toast.success('示例数据创建成功！', {
        description: `已创建 ${data.created?.agents || 0} 个Agent、${data.created?.issues || 0} 个Issue`,
      })
      return data
    } catch {
      toast.error('创建示例数据失败，请重试')
      return null
    } finally {
      setSeeding(false)
    }
  }, [queryClient])

  const dismiss = useCallback(() => {
    setDismissed(true)
    setShouldPrompt(false)
  }, [])

  const showPrompt = shouldPrompt && !dismissed

  return {
    showPrompt,
    seeding,
    seedData,
    dismiss,
    isSeeded: typeof window !== 'undefined' ? !!localStorage.getItem(SEEDED_KEY) : false,
  }
}
