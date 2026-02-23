'use client'

import { CommentBox } from './CommentBox'
import { CommentList } from './CommentList'
import { useTranslations } from 'next-intl'
import { Comment } from '@/interfaces/comment/comment.interface'
import { Empty } from '@/components/common/content/Empty'
import { useCommentListStore } from '@/store/commentListStore'

interface CommentContentProps {
  comments: Comment[] | []
  game_id: string
}

export const CommentContent = ({ game_id, comments }: CommentContentProps) => {
  const t = useTranslations('Components.Common.Comment.CommentContent')
  const { getLength } = useCommentListStore()
  const commentLength = getLength() || comments.length

  return (
    <div className="flex flex-col gap-4 w-full" id="comment-content">
      <div className="flex flex-col gap-2">
        <h2 className="flex items-center gap-4 text-lg font-bold">
          <div className="w-1 h-6 bg-primary rounded" />
          {t('comments')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>
      <CommentBox game_id={game_id} />
      <CommentList comments={comments} />
      {commentLength === 0 && <Empty />}
    </div>
  )
}
