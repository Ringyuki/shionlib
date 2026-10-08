import { useState } from 'react'
import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import { useAuthGate } from '~/shared/ui/auth-gate'
import { likesOf, type CommentItem, type LikeFlip } from './comment'
import type { commentLikeAction } from './comment.server'

export function useCommentLike(comment: Pick<CommentItem, 'id' | 'is_liked' | 'like_count'>) {
  const gate = useAuthGate()
  const [flip, setFlip] = useState<LikeFlip | undefined>(undefined)
  const command = useCommand(
    useFetcher<typeof commentLikeAction>(),
    href('/resources/comments/like'),
    { revalidate: false },
  )
  const shown = likesOf(comment, flip)
  const toggle = async () => {
    const before = flip
    setFlip(shown.liked === comment.is_liked ? { from: comment.is_liked } : undefined)
    const outcome = await command.run({ commentId: comment.id })
    if (!outcome.ok) {
      setFlip(before)
    }
  }
  return {
    ...shown,
    pending: command.pending,
    toggle: () => (gate.signedIn ? void toggle() : gate.requireSignIn(() => void toggle())),
  }
}
