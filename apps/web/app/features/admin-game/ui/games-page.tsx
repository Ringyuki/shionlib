import {
  AlertDialog,
  Card,
  Inline,
  PageHeader,
  SearchInput,
  SegmentedControl,
  Select,
  Stack,
  toast,
} from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { pageSize, useQueryDraft } from '~/features/admin'
import { PatchPagesDialog } from '~/features/admin-patch-page'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { useLast } from '~/shared/ui/use-last'
import {
  maxQueryLength,
  narrowed,
  queryDelay,
  searchOf,
  sorts,
  statuses,
  titlesOf,
  type Filter,
  type Game,
} from '../admin-game'
import type { Listing } from '../admin-game.use-cases'
import { useGameChange } from '../use-game-change'
import { GameTable } from './game-table'

const every = 'all'

export function GamesPage({ filter, games, total }: Listing) {
  const t = useTranslations('adminGame')
  const shared = useTranslations('admin')
  const stay = useInPageNavigate()
  const [removing, setRemoving] = useState<Game>()
  const asked = useLast(removing)
  const [patching, setPatching] = useState<Game>()
  const patched = useLast(patching)
  const remove = useGameChange()
  const show = (changes: Partial<Filter>, replace = false) =>
    stay({ search: searchOf({ ...filter, ...changes }) }, { replace })
  const query = useQueryDraft(filter.query, queryDelay, wanted => show({ query: wanted }, true))
  const name = asked === undefined ? '' : titlesOf(asked).main
  return (
    <Stack gap="lg">
      <PageHeader title={t('title')} />
      <Card padded={false}>
        <Inline gap="sm" align="center" className="border-line border-b px-(--hn-panel-p) py-3">
          <SegmentedControl
            size="sm"
            aria-label={t('column.status')}
            value={filter.status === undefined ? every : String(filter.status)}
            options={[
              { value: every, label: t('everyStatus') },
              ...statuses.map(status => ({ value: String(status), label: t(`status.${status}`) })),
            ]}
            onValueChange={value =>
              show({ status: statuses.find(status => String(status) === value) })
            }
          />
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
        </Inline>
        <GameTable
          games={games}
          paging={{ page: filter.page, pageSize, total }}
          filtered={narrowed(filter)}
          onRemove={setRemoving}
          onPatchPages={setPatching}
        />
      </Card>
      <PatchPagesDialog
        target={
          patched === undefined ? undefined : { id: patched.id, name: titlesOf(patched).main }
        }
        open={patching !== undefined}
        onOpenChange={open => {
          if (!open) {
            setPatching(undefined)
          }
        }}
      />
      <AlertDialog
        tone="danger"
        title={t('remove.title', { name })}
        description={t('remove.description')}
        confirmText={t('remove.confirm')}
        cancelText={shared('cancel')}
        open={removing !== undefined}
        onOpenChange={open => {
          if (!open) {
            setRemoving(undefined)
          }
        }}
        onConfirm={async () => {
          if (removing !== undefined) {
            await remove.confirm({ action: 'remove', id: removing.id })
            toast.success(t('remove.done', { name }))
          }
        }}
      />
    </Stack>
  )
}
