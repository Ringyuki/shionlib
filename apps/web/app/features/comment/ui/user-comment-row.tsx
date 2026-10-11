import { cn, Inline, Text } from '@hina-ui/react'
import { ThumbsUp } from 'lucide-react'
import { Link } from 'react-router'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { gameTitle } from '~/features/game'
import { publicText } from '~/shared/richtext/rich-text'
import { entryLink } from '~/shared/ui/entry-link'
import { firstLine, pathOfComment, type UserComment } from '../comment'

export function UserCommentRow({ comment }: { comment: UserComment }) {
  const t = useTranslations('comment')
  const locale = useLocale()
  const format = useFormatter()
  const game = gameTitle(comment.game, locale)
  const { parent, resource } = comment
  const where = resource === null ? 'user' : 'userResource'
  const file = resource?.file_name ?? ''
  return (
    <Link
      to={pathOfComment(locale, comment)}
      prefetch="intent"
      className={cn(entryLink, 'flex flex-col gap-1 p-3')}
    >
      <Text size="xs" tone="faint" className="break-words">
        {parent === null
          ? t(`${where}Comment`, { game, file })
          : t(`${where}Reply`, { game, file, name: parent.creator.name })}
      </Text>
      {parent !== null && (
        <Text size="sm" tone="faint" truncate>
          {firstLine(publicText(parent.content))}
        </Text>
      )}
      <Text className="line-clamp-3 break-words whitespace-pre-line">
        {publicText(comment.content)}
      </Text>
      <Inline align="center" className="gap-x-4 gap-y-1">
        <Text size="xs" tone="faint">
          {format.dateTime(new Date(comment.created), { dateStyle: 'long' })}
        </Text>
        {comment.reply_count > 0 && (
          <Text size="xs" tone="faint" className="tabular-nums">
            {t('replyCount', { count: comment.reply_count })}
          </Text>
        )}
        {comment.like_count > 0 && (
          <Inline
            as="span"
            gap="xs"
            align="center"
            wrap={false}
            role="img"
            aria-label={t('likes', { count: comment.like_count })}
            className="text-faint"
          >
            <ThumbsUp aria-hidden className="size-3.5" />
            <Text as="span" size="xs" tone="faint" className="tabular-nums">
              {format.number(comment.like_count)}
            </Text>
          </Inline>
        )}
      </Inline>
    </Link>
  )
}
