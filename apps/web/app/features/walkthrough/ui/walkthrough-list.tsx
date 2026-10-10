import { DataList, Empty, Inline, Link, Text } from '@hina-ui/react'
import { Plus } from 'lucide-react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { usePageTurn } from '~/shared/route/use-page-turn'
import { Button } from '~/shared/ui/button'
import { pageSize, walkthroughPath, writingPath, type Walkthroughs } from '../walkthrough'
import { WalkthroughCredit } from './walkthrough-byline'
import { WalkthroughState } from './walkthrough-state'

export function WalkthroughList({ walkthroughs }: { walkthroughs: Walkthroughs }) {
  const t = useTranslations('walkthrough')
  const locale = useLocale()
  const pages = usePageTurn()
  const { gameId, items, total, page } = walkthroughs
  const writing = (
    <RouterLink to={writingPath(locale, gameId)}>
      <Plus aria-hidden />
      {t('write')}
    </RouterLink>
  )
  return (
    <DataList
      label={t('list')}
      items={items}
      itemKey="id"
      className="mx-auto max-w-3xl"
      minHeight={0}
      manual
      pagination
      total={total}
      page={page}
      pageSize={pageSize}
      onPageChange={pages.turnTo}
      loading={pages.turning}
      renderTitle={({ item }) => (
        <Inline gap="sm" align="center">
          <Link asChild tone="neutral" className="text-md font-semibold break-words">
            <RouterLink to={walkthroughPath(locale, gameId, item.id)} prefetch="intent">
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
      renderMeta={({ item }) => <WalkthroughCredit walkthrough={item} />}
      renderFooter={
        total === 0
          ? undefined
          : () => (
              <Button asChild loginRequired variant="outline" tone="neutral">
                {writing}
              </Button>
            )
      }
      renderEmpty={() => (
        <Empty
          title={t('empty')}
          actions={
            <Button asChild loginRequired>
              {writing}
            </Button>
          }
        />
      )}
    />
  )
}
