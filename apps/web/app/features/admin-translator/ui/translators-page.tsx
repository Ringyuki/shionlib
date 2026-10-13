import {
  Card,
  Inline,
  PageHeader,
  SearchInput,
  SegmentedControl,
  Select,
  Stack,
  Text,
} from '@hina-ui/react'
import { useState } from 'react'
import { useFormatter, useTranslations } from 'use-intl'
import { pageSize, useQueryDraft } from '~/features/admin'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import {
  maxQueryLength,
  queryDelay,
  searchOf,
  sorts,
  views,
  type Cluster,
  type Filter,
  type Translator,
} from '../admin-translator'
import type { Listing } from '../admin-translator.use-cases'
import { DuplicateList } from './duplicate-list'
import { EditDialog } from './edit-dialog'
import { MergeDialog } from './merge-dialog'
import { TranslatorTable } from './translator-table'

export function TranslatorsPage({ filter, translators, total, clusters }: Listing) {
  const t = useTranslations('adminTranslator')
  const format = useFormatter()
  const stay = useInPageNavigate()
  const [editing, setEditing] = useState<Translator>()
  const [merging, setMerging] = useState<Cluster>()
  const show = (changes: Partial<Filter>, replace = false) =>
    stay({ search: searchOf({ ...filter, ...changes }) }, { replace })
  const query = useQueryDraft(filter.query, queryDelay, wanted => show({ query: wanted }, true))
  const listed = filter.view === 'all'
  return (
    <Stack gap="lg">
      <PageHeader title={t('title')} />
      <Card padded={false}>
        <Inline gap="sm" align="center" className="border-line border-b px-(--hn-panel-p) py-3">
          <SegmentedControl
            size="sm"
            aria-label={t('view.label')}
            value={filter.view}
            options={views.map(view => ({
              value: view,
              label: t(`view.${view}`),
              count: view === 'duplicates' ? clusters.length : 0,
            }))}
            onValueChange={value => show({ view: views.find(view => view === value) })}
            renderOption={({ option }) => (
              <Inline as="span" gap="xs" align="center" wrap={false}>
                {option.label}
                {option.count > 0 && (
                  <Text as="span" size="sm" tone="faint" className="tabular-nums">
                    {format.number(option.count)}
                  </Text>
                )}
              </Inline>
            )}
          />
          {listed && (
            <>
              <SearchInput
                size="sm"
                aria-label={t('search')}
                placeholder={t('search')}
                className="w-64 max-sm:w-full"
                maxLength={maxQueryLength}
                value={query.draft}
                loading={query.searching}
                onValueChange={query.setDraft}
              />
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
            </>
          )}
        </Inline>
        {listed ? (
          <TranslatorTable
            translators={translators}
            paging={{ page: filter.page, pageSize, total }}
            filtered={filter.query !== ''}
            onEdit={setEditing}
          />
        ) : (
          <DuplicateList clusters={clusters} onMerge={setMerging} />
        )}
      </Card>
      <EditDialog translator={editing} onClose={() => setEditing(undefined)} />
      <MergeDialog cluster={merging} onClose={() => setMerging(undefined)} />
    </Stack>
  )
}
