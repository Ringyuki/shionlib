import { DropdownMenu, DropdownMenuItem, Inline, Text, Toggle } from '@hina-ui/react'
import { Ellipsis, MessageSquareReply, PencilLine, ThumbsUp, Trash2 } from 'lucide-react'
import { useFormatter, useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import type { CommentItem } from '../comment'
import { useCommentLike } from '../use-comment-like'

type CommentActionsProps = {
  comment: CommentItem
  own: boolean
  onReply: () => void
  onEdit: () => void
  onRemove: () => void
}

export function CommentActions({ comment, own, onReply, onEdit, onRemove }: CommentActionsProps) {
  const t = useTranslations('comment')
  const format = useFormatter()
  const like = useCommentLike(comment)
  return (
    <Inline gap="xs" align="center" className="-ms-2">
      <Toggle
        size="sm"
        tooltip={false}
        label={t(like.liked ? 'unlike' : 'like')}
        value={like.liked}
        onValueChange={like.toggle}
      >
        <ThumbsUp aria-hidden />
        {like.count > 0 && (
          <Text as="span" size="inherit" className="text-inherit tabular-nums">
            {format.number(like.count)}
          </Text>
        )}
      </Toggle>
      <Button
        size="sm"
        variant="ghost"
        tone="neutral"
        loginRequired
        icon={<MessageSquareReply />}
        onClick={onReply}
      >
        {t('reply')}
      </Button>
      {own && (
        <DropdownMenu
          label={t('actions')}
          align="start"
          content={
            <>
              <DropdownMenuItem icon={<PencilLine />} onSelect={onEdit}>
                {t('edit')}
              </DropdownMenuItem>
              <DropdownMenuItem icon={<Trash2 />} tone="danger" onSelect={onRemove}>
                {t('remove')}
              </DropdownMenuItem>
            </>
          }
        >
          <Button size="sm" variant="ghost" tone="neutral" iconOnly aria-label={t('actions')}>
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenu>
      )}
    </Inline>
  )
}
