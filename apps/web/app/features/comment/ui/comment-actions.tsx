import { DropdownMenu, DropdownMenuItem, Inline } from '@hina-ui/react'
import { Ellipsis, PencilLine, Pin, PinOff, ThumbsUp, Trash2 } from 'lucide-react'
import { useFormatter, useTranslations } from 'use-intl'
import { Button, IconButton } from '~/shared/ui/button'
import { flushStart } from '~/shared/ui/flush'
import type { CommentItem, PinRights } from '../comment'
import { useCommentLike } from '../use-comment-like'

type CommentActionsProps = {
  comment: CommentItem
  own: boolean
  pinning: PinRights
  replying: boolean
  onReply: () => void
  onEdit: () => void
  onRemove: () => void
  onPin: () => void
  onUnpin: () => void
}

export function CommentActions({
  comment,
  own,
  pinning,
  replying,
  onReply,
  onEdit,
  onRemove,
  onPin,
  onUnpin,
}: CommentActionsProps) {
  const t = useTranslations('comment')
  const format = useFormatter()
  const like = useCommentLike(comment)
  return (
    <Inline gap="xs" align="center" className={flushStart.sm}>
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
      {(own || pinning.pin || pinning.unpin) && (
        <DropdownMenu
          label={t('actions')}
          align="start"
          content={
            <>
              {pinning.pin && (
                <DropdownMenuItem icon={<Pin />} onSelect={onPin}>
                  {t('pin')}
                </DropdownMenuItem>
              )}
              {pinning.unpin && (
                <DropdownMenuItem icon={<PinOff />} onSelect={onUnpin}>
                  {t('unpin')}
                </DropdownMenuItem>
              )}
              {own && (
                <>
                  <DropdownMenuItem icon={<PencilLine />} onSelect={onEdit}>
                    {t('edit')}
                  </DropdownMenuItem>
                  <DropdownMenuItem icon={<Trash2 />} tone="danger" onSelect={onRemove}>
                    {t('remove')}
                  </DropdownMenuItem>
                </>
              )}
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
