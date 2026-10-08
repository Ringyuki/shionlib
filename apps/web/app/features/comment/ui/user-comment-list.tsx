import { DataList, Empty, Inline, Link, Stack, Text, Time } from '@hina-ui/react'
import { MessageSquare, ThumbsUp } from 'lucide-react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { gameTitle } from '~/features/game'
import { usePageTurn } from '~/shared/route/use-page-turn'
import { BBCodeText } from '~/shared/ui/bbcode-text'
import { commentAnchor, commentsPath, sourceOf, userPageSize, type UserComments } from '../comment'

type UserCommentListProps = {
  comments: UserComments
  own: boolean
}

export function UserCommentList({ comments, own }: UserCommentListProps) {
  const t = useTranslations('comment')
  const locale = useLocale()
  const pages = usePageTurn()
  return (
    <DataList
      label={t('userList')}
      items={comments.items}
      itemKey="id"
      manual
      pagination
      total={comments.total}
      page={comments.page}
      pageSize={userPageSize}
      onPageChange={pages.turnTo}
      loading={pages.turning}
      renderEmpty={() => (
        <Empty icon={<MessageSquare />} title={t(own ? 'userEmptyOwn' : 'userEmpty')} size="sm" />
      )}
    >
      {({ item }) => (
        <Stack gap="xs">
          <Inline gap="sm" align="center" className="gap-y-0.5">
            <Text size="sm" tone="muted">
              {t.rich('on', {
                game: () => (
                  <Link asChild>
                    <RouterLink
                      to={`${commentsPath(locale, item.game.id)}#${commentAnchor(item.id)}`}
                      prefetch="intent"
                    >
                      {gameTitle(item.game, locale)}
                    </RouterLink>
                  </Link>
                ),
              })}
            </Text>
            <Text size="sm" tone="faint">
              <Time value={item.created} format="relative" />
            </Text>
          </Inline>
          {item.parent !== null && (
            <Text size="sm" tone="muted">
              {t('answering', { name: item.parent.creator.name })}
            </Text>
          )}
          <BBCodeText source={sourceOf(item)} className="max-w-prose" />
          {item.like_count > 0 && (
            <Inline gap="xs" align="center">
              <ThumbsUp aria-hidden className="size-3.5 text-faint" />
              <Text size="sm" tone="faint" className="tabular-nums">
                {t('likes', { count: item.like_count })}
              </Text>
            </Inline>
          )}
        </Stack>
      )}
    </DataList>
  )
}
