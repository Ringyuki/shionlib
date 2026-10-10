import { DataList, Empty, Link, Text, Time } from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { gamePath, gameTitle } from '~/features/game'
import { publicText } from '~/shared/richtext/rich-text'
import { usePageTurn } from '~/shared/route/use-page-turn'
import { commentPath, userPageSize, type UserComments } from '../comment'

export function UserCommentList({ comments }: { comments: UserComments }) {
  const t = useTranslations('comment')
  const locale = useLocale()
  const pages = usePageTurn()
  return (
    <DataList
      label={t('userList')}
      items={comments.items}
      itemKey="id"
      className="mx-auto max-w-3xl"
      minHeight={0}
      manual
      pagination
      total={comments.total}
      page={comments.page}
      pageSize={userPageSize}
      onPageChange={pages.turnTo}
      loading={pages.turning}
      renderTitle={({ item }) => (
        <Link asChild tone="neutral" className="line-clamp-3 font-normal break-words">
          <RouterLink to={commentPath(locale, item.game.id, item.id)} prefetch="intent">
            {item.parent !== null && (
              <Text as="span" tone="faint">
                {t('answering', { name: item.parent.creator.name })}
              </Text>
            )}
            {publicText(item.content)}
          </RouterLink>
        </Link>
      )}
      renderMeta={({ item }) => (
        <Text as="span" size="sm" tone="faint">
          <Link asChild>
            <RouterLink to={gamePath(locale, item.game.id)} prefetch="intent">
              {gameTitle(item.game, locale)}
            </RouterLink>
          </Link>
          {' · '}
          <Time value={item.created} format="relative" />
          {item.like_count > 0 && ` · ${t('likes', { count: item.like_count })}`}
        </Text>
      )}
      renderEmpty={() => <Empty title={t('userEmpty')} />}
    />
  )
}
