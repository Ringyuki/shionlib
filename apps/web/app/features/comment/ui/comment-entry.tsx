import {
  Avatar,
  cn,
  Inline,
  Link,
  Stack,
  Tag,
  Text,
  Time,
  Tooltip,
  useImageResolver,
} from '@hina-ui/react'
import { memo, useState, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { profilePath } from '~/features/profile'
import { RichText } from '~/shared/ui/rich-text'
import { commentAnchor, isPending, type CommentItem } from '../comment'
import { useCommentFocus } from '../use-comment-focus'
import { CommentActions } from './comment-actions'
import { EditComment } from './edit-comment'

type CommentEntryProps = {
  comment: CommentItem
  own: boolean
  publisher: boolean
  canPin?: boolean
  canUnpin?: boolean
  answered?: string
  nested?: boolean
  replying: boolean
  onReply: (comment: CommentItem) => void
  onRemove: (comment: CommentItem) => void
  onPin?: (comment: CommentItem) => void
  onUnpin?: (comment: CommentItem) => void
  children?: ReactNode
}

export const CommentEntry = memo(function CommentEntry({
  comment,
  own,
  publisher,
  canPin = false,
  canUnpin = false,
  answered,
  nested = false,
  replying,
  onReply,
  onRemove,
  onPin,
  onUnpin,
  children,
}: CommentEntryProps) {
  const t = useTranslations('comment')
  const locale = useLocale()
  const resolveImage = useImageResolver()
  const [editing, setEditing] = useState(false)
  const { entry, focused } = useCommentFocus(comment.id)
  const { creator } = comment
  const profile = profilePath(locale, creator.id)
  return (
    <Inline
      as="article"
      ref={entry}
      id={commentAnchor(comment.id)}
      gap={nested ? 'sm' : 'md'}
      align="start"
      wrap={false}
      className={cn(
        '-mx-2 scroll-mt-24 rounded-lg px-2 pt-2 transition-colors duration-700',
        nested && 'pb-2',
        focused && 'bg-accent-soft',
      )}
    >
      <RouterLink to={profile} aria-hidden tabIndex={-1} className="shrink-0">
        <Avatar
          size={nested ? 'sm' : 'md'}
          name={creator.name}
          src={creator.avatar === null ? undefined : resolveImage(creator.avatar, 'image')}
          className={nested ? 'sm:size-7' : 'sm:size-9'}
        />
      </RouterLink>
      <Stack gap="none" className="min-w-0 flex-1">
        <Stack gap="xs">
          <Inline
            gap="sm"
            align="center"
            className={cn('gap-y-0.5', !nested && 'min-h-8 sm:min-h-9')}
          >
            <Link asChild tone="neutral" className="font-medium">
              <RouterLink to={profile}>{creator.name}</RouterLink>
            </Link>
            {publisher && (
              <Tag size="sm" tone="accent">
                {t('publisher')}
              </Tag>
            )}
            <Text size="sm" tone="faint">
              <Time value={comment.created} format="relative" />
            </Text>
            {comment.edited && (
              <Text size="sm" tone="faint">
                {t('edited')}
              </Text>
            )}
            {isPending(comment) && (
              <Tooltip content={t('pendingHint')}>
                <Tag size="sm" tone="warning" tabIndex={0}>
                  {t('pending')}
                </Tag>
              </Tooltip>
            )}
          </Inline>
          {editing ? (
            <EditComment comment={comment} onDone={() => setEditing(false)} />
          ) : (
            <>
              <RichText
                document={comment.content}
                lead={
                  answered === undefined ? undefined : (
                    <Text as="span" tone="faint">
                      {t('answering', { name: answered })}
                    </Text>
                  )
                }
              />
              <CommentActions
                comment={comment}
                own={own}
                pinning={{ pin: canPin, unpin: canUnpin }}
                replying={replying}
                onReply={() => onReply(comment)}
                onRemove={() => onRemove(comment)}
                onEdit={() => setEditing(true)}
                onPin={() => onPin?.(comment)}
                onUnpin={() => onUnpin?.(comment)}
              />
            </>
          )}
        </Stack>
        {children}
      </Stack>
    </Inline>
  )
})
