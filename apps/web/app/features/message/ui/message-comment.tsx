import { Blockquote, Inline, Stack } from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { commentPath, resourceCommentPath } from '~/features/comment'
import { Button } from '~/shared/ui/button'
import { RichText } from '~/shared/ui/rich-text'
import type { MessageDetail } from '../message'

type MessageCommentProps = {
  comment: NonNullable<MessageDetail['comment']>
  gameId: number | undefined
}

export function MessageComment({ comment, gameId }: MessageCommentProps) {
  const t = useTranslations('message')
  const locale = useLocale()
  const place =
    comment.resource_id !== null
      ? resourceCommentPath(locale, comment.resource_id, comment.id)
      : gameId === undefined
        ? undefined
        : commentPath(locale, gameId, comment.id)
  return (
    <Stack gap="sm">
      <Blockquote>
        <RichText document={comment.content} />
      </Blockquote>
      {place !== undefined && (
        <Inline>
          <Button asChild size="sm" variant="outline" tone="neutral">
            <RouterLink to={place}>{t('openComment')}</RouterLink>
          </Button>
        </Inline>
      )}
    </Stack>
  )
}
