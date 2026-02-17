'use client'

import { useCommentListStore } from '@/store/commentListStore'
import { Comment } from '@/interfaces/comment/comment.interface'
import { CommentItem } from './CommentItem'
import { useEffect, useMemo, useState } from 'react'

export const CommentListClient = ({ initial }: { initial: Comment[] }) => {
  const { comments, setComments } = useCommentListStore()
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    setComments(initial)
    setHydrated(true)
  }, [initial, setComments])

  const list = hydrated ? comments : initial
  const sorted = useMemo(
    () => [...list].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()),
    [list],
  )

  return (
    <div className="flex flex-col gap-4">
      {sorted.map(comment => {
        return (
          <CommentItem key={comment.id} comment={comment} className="shadow-none overflow-hidden" />
        )
      })}
    </div>
  )
}
