import { Button, Inline, SearchInput, SegmentedControl, Select, Tag } from '@hina-ui/react'
import { X } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { useQueryDraft } from '~/features/admin'
import { maxQueryLength, queryDelay, sorts, statuses, type Filter } from '../admin-open'

const every = 'all'

type KeyFiltersProps = {
  filter: Filter
  onChange: (changes: Partial<Filter>, replace?: boolean) => void
}

export function KeyFilters({ filter, onChange }: KeyFiltersProps) {
  const t = useTranslations('adminOpen')
  const query = useQueryDraft(filter.query, queryDelay, wanted =>
    onChange({ query: wanted, key: undefined }, true),
  )
  return (
    <Inline gap="sm" align="center" className="border-line border-b px-(--hn-panel-p) py-3">
      <SegmentedControl
        size="sm"
        aria-label={t('filter.status')}
        value={filter.status ?? every}
        options={[
          { value: every, label: t('filter.all') },
          ...statuses.map(status => ({ value: status, label: t(`status.${status}`) })),
        ]}
        onValueChange={value =>
          onChange({ status: statuses.find(status => status === value), key: undefined })
        }
      />
      <SearchInput
        size="sm"
        aria-label={t('filter.search')}
        placeholder={t('filter.search')}
        className="w-72 max-sm:w-full"
        maxLength={maxQueryLength}
        value={query.draft}
        loading={query.searching}
        onValueChange={query.setDraft}
      />
      {filter.user !== undefined && (
        <Tag size="md">
          {t('filter.user', { id: filter.user })}
          <Button
            size="xs"
            variant="ghost"
            tone="neutral"
            icon={<X />}
            aria-label={t('filter.clearUser')}
            onClick={() => onChange({ user: undefined, key: undefined })}
          />
        </Tag>
      )}
      <Select
        size="sm"
        aria-label={t('filter.sort')}
        className="ms-auto w-44"
        value={filter.sort}
        options={sorts.map(sort => ({ value: sort, label: t(`sort.${sort}`) }))}
        onValueChange={value =>
          onChange({ sort: sorts.find(sort => sort === value) ?? filter.sort })
        }
      />
    </Inline>
  )
}
