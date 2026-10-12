import { Chip, Inline, SearchInput, SegmentedControl, Select, Text } from '@hina-ui/react'
import { Check, EyeOff } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { usePending, useQueryDraft } from '~/features/admin'
import { Button } from '~/shared/ui/button'
import {
  maxQueryLength,
  pending,
  queryDelay,
  sorts,
  statusFilters,
  type Filter,
  type Narrowing,
} from '../admin-comment'
import { statusFilterFrom } from '../admin-comment.schema'

type FiltersProps = {
  filter: Filter
  authorName: string | undefined
  onShow: (changes: Partial<Narrowing>, replace?: boolean) => void
}

export function CommentFilters({ filter, authorName, onShow }: FiltersProps) {
  const t = useTranslations('adminComment')
  const waiting = usePending()?.comments ?? 0
  const query = useQueryDraft(filter.query, queryDelay, wanted => onShow({ query: wanted }, true))
  return (
    <>
      <SegmentedControl
        size="sm"
        aria-label={t('statusFilter')}
        value={String(filter.status)}
        options={statusFilters.map(status => ({
          value: String(status),
          label:
            status === pending && waiting > 0
              ? t('pendingOf', { count: waiting })
              : t(`status.${status}`),
        }))}
        onValueChange={value => onShow({ status: statusFilterFrom(value) ?? filter.status })}
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
        <Chip removable onRemove={() => onShow({ author: undefined })}>
          {t('byAuthor', { name: authorName ?? `#${filter.author}` })}
        </Chip>
      )}
      <Select
        size="sm"
        aria-label={t('sortBy')}
        className="w-32 sm:ms-auto"
        value={filter.sort}
        options={sorts.map(sort => ({ value: sort, label: t(`sort.${sort}`) }))}
        onValueChange={value => onShow({ sort: sorts.find(sort => sort === value) ?? filter.sort })}
      />
    </>
  )
}

type BulkBarProps = {
  count: number
  busy: boolean
  onApprove: () => void
  onBlock: () => void
  onClear: () => void
}

export function BulkBar({ count, busy, onApprove, onBlock, onClear }: BulkBarProps) {
  const t = useTranslations('adminComment')
  const shared = useTranslations('admin')
  return (
    <>
      <Text as="span" size="sm" weight="medium">
        {shared('selected', { count })}
      </Text>
      <Button
        size="sm"
        variant="outline"
        tone="neutral"
        icon={<Check />}
        loading={busy}
        onClick={onApprove}
      >
        {t('verdict.1')}
      </Button>
      <Button
        size="sm"
        variant="outline"
        tone="neutral"
        icon={<EyeOff />}
        disabled={busy}
        onClick={onBlock}
      >
        {t('verdict.3')}
      </Button>
      <Inline className="ms-auto">
        <Button size="sm" variant="ghost" tone="neutral" disabled={busy} onClick={onClear}>
          {shared('clearSelection')}
        </Button>
      </Inline>
    </>
  )
}
