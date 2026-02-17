'use client'

import { Card, CardContent } from '@/components/shionui/Card'
import { Comment, CommentStatus } from '@/interfaces/comment/comment.interface'
import { Avatar } from '@/components/common/user/Avatar'
import { timeFromNow } from '@/utils/time-format'
import { useLocale } from 'next-intl'
import { CommentActions } from './actions/CommentActions'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { ReplyBox } from './actions/ReplyBox'
import { useParams } from 'next/navigation'
import { CommentParent } from './CommentParent'
import { useScrollToElem } from '@/hooks/useScrollToElem'
import { Badge } from '@/components/shionui/Badge'
import { EyeOff } from 'lucide-react'
import { cn } from '@/utils/cn'

interface CommentItemProps {
  comment: Comment
  likeable?: boolean
  showReplyBtn?: boolean
  showDeleteBtn?: boolean
  canScrollToParent?: boolean
  showEditBtn?: boolean
  onEdited?: () => void
  showSource?: boolean
  sourceTitle?: string
  className?: string
}

export const CommentItem = ({
  comment,
  likeable = true,
  showReplyBtn = true,
  showDeleteBtn = true,
  canScrollToParent = true,
  showEditBtn = true,
  onEdited,
  showSource = false,
  sourceTitle,
  className,
}: CommentItemProps) => {
  const locale = useLocale()
  const t = useTranslations('Components.Common.Comment.CommentItem')
  const [isReply, setIsReply] = useState(false)
  const { id: game_id } = useParams()
  const scrollToComment = useScrollToElem({ updateHash: false, behavior: 'instant' })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const targetHash = `#data-comment-id-${comment.id}`
    if (window.location.hash !== targetHash) return
    const commentElement = document.getElementById(targetHash.slice(1))
    if (!commentElement) return

    scrollToComment(commentElement)
    commentElement.classList.add('bg-primary/15')
    const timeout = window.setTimeout(() => {
      commentElement.classList.remove('bg-primary/15')
    }, 1000)

    return () => window.clearTimeout(timeout)
  }, [comment.id, scrollToComment])

  return (
    <Card className={cn('py-0', className)}>
      <CardContent
        className="flex flex-col gap-4 p-4 transition-colors duration-200 scroll-mt-20"
        id={`data-comment-id-${comment.id}`}
      >
        <div className="flex items-center gap-2">
          <Avatar user={comment.creator} className="size-8" />
          <div className="flex flex-col">
            <span className="text-sm font-medium flex items-center gap-2">
              {comment.creator.name}
              {showSource && (
                <span className="text-xs font-light">
                  {t('source')} {sourceTitle}
                </span>
              )}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-xs text-secondary-foreground font-light">
                {timeFromNow(comment.created, locale)}
              </span>
              {comment.edited && (
                <span className="text-xs text-secondary-foreground/50 font-light">
                  {t('edited')} {timeFromNow(comment.updated, locale)}
                </span>
              )}
            </span>
          </div>
          {comment.status === CommentStatus.HIDDEN && (
            <div className="flex items-center gap-2">
              <Badge variant="warning">{t('pending')}</Badge>
              <Badge variant="neutral">
                <EyeOff className="size-4" />
                {t('hidden')}
              </Badge>
            </div>
          )}
        </div>
        {comment.parent?.id && (
          <CommentParent parent={comment.parent} canScrollToParent={canScrollToParent} />
        )}
        <div
          className="[&_a]:text-primary [&_a]:hover:text-primary/80 [&_a]:transition-colors [&_a]:duration-200 [&_a]:hover:underline [&_a]:underline-offset-2 [&_a]:decoration-2 [&_a]:decoration-primary"
          dangerouslySetInnerHTML={{ __html: comment.html || '' }}
        />
        <CommentActions
          comment_id={comment.id}
          creator_id={comment.creator.id}
          like_count={comment.like_count}
          is_liked={comment.is_liked}
          onReplyClick={() => setIsReply(!isReply)}
          likeable={likeable}
          showReplyBtn={showReplyBtn}
          showDeleteBtn={showDeleteBtn}
          showEditBtn={showEditBtn}
          onEdited={onEdited}
        />
        <ReplyBox
          isReply={isReply}
          game_id={game_id as string}
          parent_id={comment.id}
          onSubmitSuccess={() => setIsReply(false)}
        />
      </CardContent>
    </Card>
  )
}
