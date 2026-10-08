import { DataList, Empty, Link, Stack, Text } from '@hina-ui/react'
import { BookOpenText, PenLine } from 'lucide-react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { usePageTurn } from '~/shared/route/use-page-turn'
import { Button } from '~/shared/ui/button'
import { editorPath, pageSize, walkthroughPath, type Walkthroughs } from '../walkthrough'
import { WalkthroughFacts } from './walkthrough-facts'

export function WalkthroughList({ walkthroughs }: { walkthroughs: Walkthroughs }) {
  const t = useTranslations('walkthrough')
  const locale = useLocale()
  const pages = usePageTurn()
  const { gameId, items, total, page } = walkthroughs
  const write = (
    <Button asChild loginRequired size="sm" icon={<PenLine />}>
      <RouterLink to={editorPath(locale, gameId)}>{t('write')}</RouterLink>
    </Button>
  )
  return (
    <DataList
      label={t('list')}
      items={items}
      itemKey="id"
      manual
      pagination
      total={total}
      page={page}
      pageSize={pageSize}
      onPageChange={pages.turnTo}
      loading={pages.turning}
      renderHeader={() => (
        <>
          <Text size="sm" tone="muted" className="tabular-nums">
            {t('count', { count: total })}
          </Text>
          {write}
        </>
      )}
      renderEmpty={() => <Empty icon={<BookOpenText />} title={t('empty')} size="sm" />}
    >
      {({ item }) => (
        <Stack gap="xs" className="min-w-0">
          <Link asChild tone="neutral" className="font-medium break-words">
            <RouterLink to={walkthroughPath(locale, gameId, item.id)} prefetch="intent">
              {item.title}
            </RouterLink>
          </Link>
          <WalkthroughFacts walkthrough={item} />
        </Stack>
      )}
    </DataList>
  )
}
