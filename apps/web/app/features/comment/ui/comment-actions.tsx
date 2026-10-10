import { DropdownMenu, DropdownMenuItem, Inline } from '@hina-ui/react'
import { Ellipsis, PencilLine, ThumbsUp, Trash2 } from 'lucide-react'
import { useFormatter, useTranslations } from 'use-intl'
import { Button, IconButton } from '~/shared/ui/button'
import type { CommentItem } from '../comment'
import { useCommentLike } from '../use-comment-like'

type CommentActionsProps = {
  comment: CommentItem
  own: boolean
  replying: boolean
  onReply: () => void
  onEdit: () => void
  onRemove: () => void
}

export function CommentActions({
  comment,
  own,
  replying,
  onReply,
  onEdit,
  onRemove,
}: CommentActionsProps) {
  const t = useTranslations('comment')
  const format = useFormatter()
  const like = useCommentLike(comment)
  return (
    <Inline gap="xs" align="center" className="-ms-2">
      <Button
        size="sm"
        variant="ghost"
        tone={like.liked ? 'accent' : 'neutral'}
        aria-label={t(like.liked ? 'unlike' : 'like')}
        aria-pressed={like.liked}
        icon={<ThumbsUp fill={like.liked ? 'currentColor' : 'none'} />}
        className="tabular-nums"
        onClick={like.toggle}
      >
        {like.count > 0 ? format.number(like.count) : undefined}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        tone="neutral"
        loginRequired
        aria-expanded={replying}
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
          <IconButton size="sm" label={t('actions')} tooltip={false}>
            <Ellipsis />
          </IconButton>
        </DropdownMenu>
      )}
    </Inline>
  )
}
