import { Avatar, Inline, Link, Stack, Tag, Text, Time, useImageResolver } from '@hina-ui/react'
import { useState, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { profilePath } from '~/features/profile'
import { BBCodeText } from '~/shared/ui/bbcode-text'
import { commentAnchor, isPending, sourceOf, type CommentItem } from '../comment'
import { CommentActions } from './comment-actions'
import { CommentEditor } from './comment-composer'

type CommentEntryProps = {
  comment: CommentItem
  own: boolean
  answering?: boolean
  onReply: () => void
  onRemove: (comment: CommentItem) => void
  children?: ReactNode
}

export function CommentEntry({
  comment,
  own,
  answering,
  onReply,
  onRemove,
  children,
}: CommentEntryProps) {
  const t = useTranslations('comment')
  const locale = useLocale()
  const resolveImage = useImageResolver()
  const [editing, setEditing] = useState(false)
  const { creator, parent } = comment
  const source = sourceOf(comment)
  const profile = profilePath(locale, creator.id)
  return (
    <Inline
      as="article"
      id={commentAnchor(comment.id)}
      gap="md"
      align="start"
      wrap={false}
      className="scroll-mt-4"
    >
      <RouterLink to={profile} aria-hidden tabIndex={-1} className="shrink-0">
        <Avatar
          size={answering === true ? 'sm' : 'md'}
          name={creator.name}
          src={creator.avatar === null ? undefined : resolveImage(creator.avatar, 'image')}
        />
      </RouterLink>
      <Stack gap="xs" className="min-w-0 flex-1">
        <Inline gap="sm" align="center" className="gap-y-0.5">
          <Link asChild tone="neutral" className="font-medium">
            <RouterLink to={profile}>{creator.name}</RouterLink>
          </Link>
          {answering === true && parent.creator != null && (
            <Text size="sm" tone="muted">
              {t('answering', { name: parent.creator.name })}
            </Text>
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
            <Tag size="sm" tone="warning">
              {t('pending')}
            </Tag>
          )}
        </Inline>
        {editing ? (
          <CommentEditor comment={comment} source={source} onDone={() => setEditing(false)} />
        ) : (
          <>
            <BBCodeText source={source} className="max-w-prose" />
            <CommentActions
              comment={comment}
              own={own}
              onReply={onReply}
              onRemove={() => onRemove(comment)}
              onEdit={() => setEditing(true)}
            />
          </>
        )}
        {children}
      </Stack>
    </Inline>
  )
}
