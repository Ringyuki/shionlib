import { toast } from '@hina-ui/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'use-intl'
import type { CommentItem } from './comment'
import { useCommentPin } from './use-comment-pin'

export function usePinning(pinned: number | undefined) {
  const t = useTranslations('comment')
  const command = useCommentPin()
  const [replacing, setReplacing] = useState<CommentItem | undefined>(undefined)
  const [asking, setAsking] = useState(false)
  const change = async (comment: CommentItem, next: boolean) => {
    const outcome = await command.run({ commentId: comment.id, pinned: next })
    if (outcome.ok) {
      toast.success(t(next ? 'pinned' : 'unpinned'))
    }
  }
  const latest = useRef({ pinned, change })
  useEffect(() => {
    latest.current = { pinned, change }
  })
  const pin = useCallback((comment: CommentItem) => {
    const now = latest.current
    if (now.pinned !== undefined && now.pinned !== comment.id) {
      setReplacing(comment)
      setAsking(true)
      return
    }
    void now.change(comment, true)
  }, [])
  const unpin = useCallback(
    (comment: CommentItem) => void latest.current.change(comment, false),
    [],
  )
  const replace = async () => {
    if (replacing !== undefined) {
      await command.confirm({ commentId: replacing.id, pinned: true })
      toast.success(t('pinned'))
    }
  }
  return { pin, unpin, replace, asking, setAsking }
}
