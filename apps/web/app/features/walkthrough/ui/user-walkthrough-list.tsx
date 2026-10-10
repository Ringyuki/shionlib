import { DataList, Empty, Inline, Link, SegmentedControl, Text } from '@hina-ui/react'
import { Link as RouterLink, useLocation } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { gamePath, gameTitle } from '~/features/game'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { listStart } from '~/shared/http/paging'
import { usePageTurn } from '~/shared/route/use-page-turn'
import { Button } from '~/shared/ui/button'
import {
  searchOnShelf,
  shelves,
  userPageSize,
  walkthroughPath,
  writingPath,
  type UserWalkthroughs,
} from '../walkthrough'
import { shelfFrom } from '../walkthrough.schema'
import { WalkthroughFacts } from './walkthrough-byline'
import { WalkthroughState } from './walkthrough-state'

type UserWalkthroughListProps = {
  walkthroughs: UserWalkthroughs
  own: boolean
}

export function UserWalkthroughList({ walkthroughs, own }: UserWalkthroughListProps) {
  const t = useTranslations('walkthrough')
  const locale = useLocale()
  const pages = usePageTurn()
  const stay = useInPageNavigate()
  const location = useLocation()
  return (
    <DataList
      label={t('userList')}
      id={listStart}
      items={walkthroughs.items}
      itemKey="id"
      className="mx-auto max-w-3xl scroll-mt-4"
      minHeight={0}
      manual
      pagination
      total={walkthroughs.total}
      page={walkthroughs.page}
      pageSize={userPageSize}
      onPageChange={pages.turnTo}
      loading={pages.turning}
      renderHeader={
        own
          ? () => (
              <SegmentedControl
                size="sm"
                aria-label={t('shelfLabel')}
                value={walkthroughs.shelf}
                onValueChange={value =>
                  stay({ search: searchOnShelf(location.search, shelfFrom(value)) })
                }
                options={shelves.map(value => ({ value, label: t(`shelf.${value}`) }))}
              />
            )
          : undefined
      }
      renderTitle={({ item }) => (
        <Inline gap="sm" align="center">
          <Link asChild tone="neutral" className="text-md font-semibold break-words">
            <RouterLink to={walkthroughPath(locale, item.game.id, item.id)} prefetch="intent">
              {item.title}
            </RouterLink>
          </Link>
          <WalkthroughState walkthrough={item} />
        </Inline>
      )}
      renderDescription={({ item }) =>
        item.excerpt === '' ? null : (
          <Text as="span" size="sm" tone="muted" className="line-clamp-2 break-words">
            {item.excerpt}
          </Text>
        )
      }
      renderMeta={({ item }) => (
        <Text as="span" size="sm" tone="faint">
          <Link asChild>
            <RouterLink to={gamePath(locale, item.game.id)} prefetch="intent">
              {gameTitle(item.game, locale)}
            </RouterLink>
          </Link>
          {' · '}
          <WalkthroughFacts walkthrough={item} />
        </Text>
      )}
      renderActions={
        own
          ? ({ item }) => (
              <Button asChild size="sm" variant="ghost" tone="neutral">
                <RouterLink to={writingPath(locale, item.game.id, item.id)}>{t('edit')}</RouterLink>
              </Button>
            )
          : undefined
      }
      renderEmpty={() => <Empty title={t('userEmpty')} />}
    />
  )
}
