import { Button, DataList, Empty } from '@hina-ui/react'
import { SearchX } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { GameTile } from '~/features/game'
import { listStart } from '~/shared/http/paging'
import {
  narrowedToResources,
  pageSize,
  type Condition,
  type LibraryAddress,
  type LibraryContent,
} from '../library'
import type { LibraryControls } from '../use-library-address'
import { AppliedConditions } from './applied-conditions'
import { ListToolbar } from './list-toolbar'

type LibraryListProps = {
  content: LibraryContent
  shown: LibraryAddress
  conditions: readonly Condition[]
  controls: LibraryControls
  filtered: boolean
  onOpenFilters: () => void
}

export function LibraryList({
  content,
  shown,
  conditions,
  controls,
  filtered,
  onOpenFilters,
}: LibraryListProps) {
  const t = useTranslations('library')
  return (
    <DataList
      label={t('label')}
      id={listStart}
      className="scroll-mt-4 xl:scroll-mt-6"
      items={content.games}
      itemKey="id"
      layout="grid"
      gridMin="9rem"
      gridGap="md"
      manual
      pagination
      total={content.total}
      page={content.address.page}
      pageSize={pageSize}
      onPageChange={controls.setPage}
      loading={controls.turning}
      renderHeader={() => (
        <>
          <ListToolbar
            address={shown}
            total={content.total}
            conditions={conditions.length}
            onChange={controls.narrow}
            onOpenFilters={onOpenFilters}
          />
          {conditions.length > 0 && (
            <AppliedConditions
              conditions={conditions}
              onChange={controls.narrow}
              className="w-full xl:hidden"
            />
          )}
        </>
      )}
      renderEmpty={() => (
        <Empty
          icon={<SearchX />}
          title={t('empty')}
          description={
            narrowedToResources(content.address, filtered) ? t('emptyNarrowed') : undefined
          }
          actions={
            conditions.length > 0 && (
              <Button variant="outline" tone="neutral" onClick={controls.reset}>
                {t('filters.resetAll')}
              </Button>
            )
          }
        />
      )}
    >
      {({ item }) => <GameTile game={item} dated="year" />}
    </DataList>
  )
}
