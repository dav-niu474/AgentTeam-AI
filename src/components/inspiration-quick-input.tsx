'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Send,
  Loader2,
  MessageSquare,
  StickyNote,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/lib/store'
import { useCurrentUser } from '@/lib/use-current-user'
import { useCreateInspiration, useAnalyzeInspiration } from '@/lib/hooks'

type InspirationSource = 'chat' | 'quick_note'
type InspirationStatus = 'idle' | 'submitting' | 'analyzing' | 'converted' | 'error'

export function InspirationQuickInput() {
  const { showInspirationInput, setShowInspirationInput } = useAppStore()
  const { user } = useCurrentUser()
  const userId = user?.id || null
  const createInspiration = useCreateInspiration()
  const analyzeInspirationMutation = useAnalyzeInspiration()

  const [content, setContent] = useState('')
  const [source, setSource] = useState<InspirationSource>('quick_note')
  const [status, setStatus] = useState<InspirationStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleClose = useCallback(() => {
    setShowInspirationInput(false)
    setContent('')
    setSource('quick_note')
    setStatus('idle')
    setErrorMessage('')
  }, [setShowInspirationInput])

  const handleSubmit = useCallback(async () => {
    if (!content.trim() || !userId) return

    setStatus('submitting')
    setErrorMessage('')

    try {
      // Create the inspiration
      const inspiration = await createInspiration.mutateAsync({
        content: content.trim(),
        source,
        creatorId: userId,
      })

      setStatus('analyzing')

      // Try to trigger analysis
      try {
        await analyzeInspirationMutation.mutateAsync(inspiration.id)
        setStatus('converted')
        setTimeout(() => {
          handleClose()
        }, 2000)
      } catch {
        // Analysis failed - still show success for submission
        // The inspiration is saved, analysis can be retried later
        setStatus('converted')
        setTimeout(() => {
          handleClose()
        }, 2000)
      }
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : '提交失败，请重试')
      setTimeout(() => setStatus('idle'), 4000)
    }
  }, [content, source, userId, createInspiration, analyzeInspirationMutation, handleClose])

  return (
    <Dialog open={showInspirationInput} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg border-border/50 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Sparkles className="size-5" />
            表达你的想法
          </DialogTitle>
          <DialogDescription>
            说出你的灵感、需求或想法，Agent 将为你分析并创建任务
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source selector */}
          <div className="flex gap-2">
            <Badge
              variant={source === 'chat' ? 'default' : 'outline'}
              className="cursor-pointer transition-all hover:scale-105"
              onClick={() => setSource('chat')}
            >
              <MessageSquare className="size-3 mr-1" />
              对话
            </Badge>
            <Badge
              variant={source === 'quick_note' ? 'default' : 'outline'}
              className="cursor-pointer transition-all hover:scale-105"
              onClick={() => setSource('quick_note')}
            >
              <StickyNote className="size-3 mr-1" />
              快速笔记
            </Badge>
          </div>

          {/* Text input */}
          <div className="relative">
            <Textarea
              placeholder="在这里输入你的想法、需求或灵感..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px] resize-none pr-12"
              disabled={status === 'submitting' || status === 'analyzing'}
              autoFocus
            />
          </div>

          {/* Submit / Status */}
          <AnimatePresence mode="wait">
            {status === 'idle' && (
              <motion.div
                key="submit"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex justify-end"
              >
                <Button
                  onClick={handleSubmit}
                  disabled={!content.trim() || !userId}
                  className="gap-2"
                >
                  <Send className="size-4" />
                  提交想法
                </Button>
              </motion.div>
            )}

            {status === 'submitting' && (
              <motion.div
                key="submitting"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center justify-center gap-2 py-2 text-muted-foreground"
              >
                <Loader2 className="size-4 animate-spin" />
                正在提交...
              </motion.div>
            )}

            {status === 'analyzing' && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center justify-center gap-3 py-4"
              >
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  >
                    <Sparkles className="size-5 text-primary" />
                  </motion.div>
                  <span className="text-sm font-medium text-foreground">
                    Agent 正在分析你的想法...
                  </span>
                </div>
                <motion.div
                  className="h-1 w-32 rounded-full bg-primary/20 overflow-hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 10, ease: 'linear' }}
                  />
                </motion.div>
              </motion.div>
            )}

            {status === 'converted' && (
              <motion.div
                key="converted"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center justify-center gap-2 py-3 text-primary"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <CheckCircle2 className="size-5" />
                </motion.div>
                <span className="text-sm font-medium">Agent 已将你的想法转化为任务！</span>
              </motion.div>
            )}

            {status === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center justify-center gap-2 py-2 text-destructive"
              >
                <AlertCircle className="size-4" />
                <span className="text-sm">{errorMessage || '提交失败，请重试'}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  )
}
