import { Blockquote, Inline, Stack } from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { commentPath } from '~/features/comment'
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
  return (
    <Stack gap="sm">
      <Blockquote>
        <RichText document={comment.content} />
      </Blockquote>
      {gameId !== undefined && (
        <Inline>
          <Button asChild size="sm" variant="outline" tone="neutral">
            <RouterLink to={commentPath(locale, gameId, comment.id)}>{t('openComment')}</RouterLink>
          </Button>
        </Inline>
      )}
    </Stack>
  )
}
