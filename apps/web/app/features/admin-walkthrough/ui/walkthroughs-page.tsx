import {
  Card,
  Chip,
  Inline,
  PageHeader,
  SearchInput,
  SegmentedControl,
  Select,
  Stack,
} from '@hina-ui/react'
import { useLocation } from 'react-router'
import { useTranslations } from 'use-intl'
import { pageSize, usePending, useQueryDraft } from '~/features/admin'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import {
  heldOnly,
  maxQueryLength,
  narrowed,
  queryDelay,
  searchOf,
  searchWith,
  sorts,
  statusFilters,
  type Narrowing,
} from '../admin-walkthrough'
import type { Listing } from '../admin-walkthrough.use-cases'
import { WalkthroughPane } from './walkthrough-pane'
import { WalkthroughTable } from './walkthrough-table'

export function WalkthroughsPage({ filter, walkthroughs, total, opened }: Listing) {
  const t = useTranslations('adminWalkthrough')
  const location = useLocation()
  const stay = useInPageNavigate()
  const waiting = usePending()?.walkthroughs ?? 0
  const show = (changes: Partial<Narrowing>, replace = false) =>
    stay({ search: searchOf({ ...filter, ...changes }) }, { replace })
  const query = useQueryDraft(filter.query, queryDelay, wanted => show({ query: wanted }, true))
  return (
    <Stack gap="lg">
      <PageHeader title={t('title')} />
      <Card padded={false}>
        <Inline gap="sm" align="center" className="border-line border-b px-(--hn-panel-p) py-3">
          <SegmentedControl
            size="sm"
            aria-label={t('statusFilter')}
            value={filter.status}
            options={statusFilters.map(status => ({
              value: status,
              label:
                status === heldOnly && waiting > 0
                  ? t('heldOf', { count: waiting })
                  : t(`status.${status}`),
            }))}
            onValueChange={value =>
              show({ status: statusFilters.find(status => status === value) ?? filter.status })
            }
          />
          <SearchInput
            size="sm"
            aria-label={t('search')}
            placeholder={t('search')}
            className="w-56 max-sm:w-full"
            maxLength={maxQueryLength}
            value={query.draft}
            loading={query.searching}
            onValueChange={query.setDraft}
          />
          {filter.author !== undefined && (
            <Chip removable onRemove={() => show({ author: undefined })}>
              {t('byAuthor', { name: walkthroughs[0]?.creator.name ?? `#${filter.author}` })}
            </Chip>
          )}
          <Select
            size="sm"
            aria-label={t('sortBy')}
            className="w-32 sm:ms-auto"
            value={filter.sort}
            options={sorts.map(sort => ({ value: sort, label: t(`sort.${sort}`) }))}
            onValueChange={value =>
              show({ sort: sorts.find(sort => sort === value) ?? filter.sort })
            }
          />
        </Inline>
        <WalkthroughTable
          walkthroughs={walkthroughs}
          paging={{ page: filter.page, pageSize, total }}
          filtered={narrowed(filter)}
          onOpen={walkthrough => stay({ search: searchWith(location.search, walkthrough.id) })}
        />
      </Card>
      <WalkthroughPane
        opened={opened}
        onClose={() => stay({ search: searchWith(location.search, undefined) })}
      />
    </Stack>
  )
}
