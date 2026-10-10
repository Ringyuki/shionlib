import { DataList, Empty, Image, Inline, Link, Text } from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { gameTitle, primaryCover } from '~/features/game'
import { listStart } from '~/shared/http/paging'
import { usePageTurn } from '~/shared/route/use-page-turn'
import {
  stateOf,
  userPageSize,
  walkthroughPath,
  writingPath,
  type UserWalkthrough,
  type UserWalkthroughs,
} from '../walkthrough'
import { WalkthroughState } from './walkthrough-state'

type UserWalkthroughListProps = { walkthroughs: UserWalkthroughs; own: boolean }

export function UserWalkthroughList({ walkthroughs, own }: UserWalkthroughListProps) {
  const t = useTranslations('walkthrough')
  const locale = useLocale()
  const pages = usePageTurn()
  const target = (item: UserWalkthrough) =>
    own && stateOf(item) !== 'published'
      ? writingPath(locale, item.game.id)
      : walkthroughPath(locale, item.game.id, item.id)
  return (
    <DataList
      label={t('userList')}
      id={listStart}
      items={walkthroughs.items}
      itemKey="id"
      className="scroll-mt-4"
      minHeight={0}
      mediaRatio={3 / 4}
      manual
      pagination
      total={walkthroughs.total}
      page={walkthroughs.page}
      pageSize={userPageSize}
      onPageChange={pages.turnTo}
      loading={pages.turning}
      renderMedia={({ item }) => (
        <Image src={primaryCover(item.game)?.url} alt="" fit="cover" className="size-full" />
      )}
      renderTitle={({ item }) => (
        <Inline as="span" gap="sm" align="center">
          <Link asChild tone="neutral">
            <RouterLink to={target(item)} prefetch="intent">
              {gameTitle(item.game, locale)}
            </RouterLink>
          </Link>
          <WalkthroughState walkthrough={item} />
        </Inline>
      )}
      renderMeta={({ item }) => (
        <Text as="span" size="xs" tone="muted">
          {t('summary', { count: item.route_count, date: new Date(item.updated) })}
        </Text>
      )}
      renderEmpty={() => <Empty title={t('empty')} />}
    />
  )
}
