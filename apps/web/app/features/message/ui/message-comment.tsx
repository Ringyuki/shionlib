import { Blockquote, Inline, Stack } from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { commentAnchor, commentsPath, sourceOf } from '~/features/comment'
import { BBCodeText } from '~/shared/ui/bbcode-text'
import { Button } from '~/shared/ui/button'
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
        <BBCodeText source={sourceOf(comment)} />
      </Blockquote>
      {gameId !== undefined && (
        <Inline>
          <Button asChild size="sm" variant="outline" tone="neutral">
            <RouterLink to={`${commentsPath(locale, gameId)}#${commentAnchor(comment.id)}`}>
              {t('openComment')}
            </RouterLink>
          </Button>
        </Inline>
      )}
    </Stack>
  )
}
