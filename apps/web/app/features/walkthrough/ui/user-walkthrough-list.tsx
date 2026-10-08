import { DataList, Empty, Link, Stack, Text } from '@hina-ui/react'
import { BookOpenText } from 'lucide-react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { gamePath, gameTitle } from '~/features/game'
import { usePageTurn } from '~/shared/route/use-page-turn'
import { userPageSize, walkthroughPath, type UserWalkthroughs } from '../walkthrough'
import { WalkthroughFacts } from './walkthrough-facts'

type UserWalkthroughListProps = {
  walkthroughs: UserWalkthroughs
  own: boolean
}

export function UserWalkthroughList({ walkthroughs, own }: UserWalkthroughListProps) {
  const t = useTranslations('walkthrough')
  const locale = useLocale()
  const pages = usePageTurn()
  return (
    <DataList
      label={t('userList')}
      items={walkthroughs.items}
      itemKey="id"
      manual
      pagination
      total={walkthroughs.total}
      page={walkthroughs.page}
      pageSize={userPageSize}
      onPageChange={pages.turnTo}
      loading={pages.turning}
      renderEmpty={() => (
        <Empty icon={<BookOpenText />} title={t(own ? 'userEmptyOwn' : 'userEmpty')} size="sm" />
      )}
    >
      {({ item }) => (
        <Stack gap="xs" className="min-w-0">
          <Link asChild tone="neutral" className="font-medium break-words">
            <RouterLink to={walkthroughPath(locale, item.game.id, item.id)} prefetch="intent">
              {item.title}
            </RouterLink>
          </Link>
          <Text size="sm" tone="muted">
            {t.rich('of', {
              game: () => (
                <Link asChild>
                  <RouterLink to={gamePath(locale, item.game.id)} prefetch="intent">
                    {gameTitle(item.game, locale)}
                  </RouterLink>
                </Link>
              ),
            })}
          </Text>
          <WalkthroughFacts walkthrough={item} />
        </Stack>
      )}
    </DataList>
  )
}
