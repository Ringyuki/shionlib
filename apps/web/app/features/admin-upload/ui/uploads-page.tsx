import {
  Card,
  Checkbox,
  Chip,
  Inline,
  PageHeader,
  SearchInput,
  Select,
  Stack,
  Text,
} from '@hina-ui/react'
import { useLocation } from 'react-router'
import { useTranslations } from 'use-intl'
import { pageSize, useQueryDraft } from '~/features/admin'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import {
  maxQueryLength,
  narrowed,
  queryDelay,
  searchOf,
  searchWith,
  stageFilters,
  type Narrowing,
} from '../admin-upload'
import type { Listing } from '../admin-upload.use-cases'
import { UploadPane } from './upload-pane'
import { keyOf, UploadTable } from './upload-table'

export function UploadsPage({ filter, uploads, total, opened }: Listing) {
  const t = useTranslations('adminUpload')
  const location = useLocation()
  const stay = useInPageNavigate()
  const show = (changes: Partial<Narrowing>, replace = false) =>
    stay({ search: searchOf({ ...filter, ...changes }) }, { replace })
  const query = useQueryDraft(filter.query, queryDelay, wanted => show({ query: wanted }, true))
  const open = (next: Parameters<typeof searchWith>[1]) =>
    stay({ search: searchWith(location.search, next) })
  const userName = uploads.find(upload => upload.uploader.id === filter.user)?.uploader.name
  return (
    <Stack gap="lg">
      <PageHeader title={t('title')} />
      <Card padded={false}>
        <Inline gap="sm" align="center" className="border-line border-b px-(--hn-panel-p) py-3">
          <Select
            size="sm"
            aria-label={t('stageFilter')}
            className="w-32"
            value={filter.stage}
            options={stageFilters.map(stage => ({ value: stage, label: t(`stage.${stage}`) }))}
            onValueChange={value =>
              show({ stage: stageFilters.find(stage => stage === value) ?? filter.stage })
            }
          />
          <SearchInput
            size="sm"
            aria-label={t('search')}
            placeholder={t('search')}
            className="w-65 max-sm:w-full"
            maxLength={maxQueryLength}
            value={query.draft}
            loading={query.searching}
            onValueChange={query.setDraft}
          />
          {filter.user !== undefined && (
            <Chip removable onRemove={() => show({ user: undefined })}>
              {t('byUser', { name: userName ?? `#${filter.user}` })}
            </Chip>
          )}
          <Checkbox
            size="sm"
            checked={filter.failed}
            onCheckedChange={checked => show({ failed: checked === true })}
          >
            {t('failedOnly')}
          </Checkbox>
          <Text as="span" size="sm" tone="muted" className="ms-auto tabular-nums">
            {t('total', { count: total })}
          </Text>
        </Inline>
        <UploadTable
          uploads={uploads}
          paging={{ page: filter.page, pageSize, total }}
          filter={filter}
          filtered={narrowed(filter)}
          current={filter.opened === undefined ? undefined : keyOf(filter.opened)}
          onOpen={upload => open({ kind: upload.kind, id: upload.id })}
        />
      </Card>
      <UploadPane opened={opened} onClose={() => open(undefined)} />
    </Stack>
  )
}
