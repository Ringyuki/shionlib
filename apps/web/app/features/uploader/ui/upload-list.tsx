import { DataList, Empty } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { ResourceViewer } from '~/features/resource'
import { listStart } from '~/shared/http/paging'
import { emptinessOf, entriesOf, pageSize, type Transfer, type UploaderContent } from '../uploader'
import { useListing } from '../use-listing'
import { DraftEntry } from './draft-entry'
import { ListToolbar } from './list-toolbar'
import { ResourceEntry } from './resource-entry'
import { TransferEntry } from './transfer-entry'

type UploadListProps = {
  content: UploaderContent
  transfers: readonly Transfer[]
  viewer: ResourceViewer | null
}

export function UploadList({ content, transfers, viewer }: UploadListProps) {
  const t = useTranslations('uploader.list')
  const { listing, resources, summary, drafts } = content
  const controls = useListing(listing)
  const emptiness = emptinessOf(listing, summary, transfers.length + drafts.length)
  return (
    <DataList
      label={t('label')}
      id={listStart}
      className="scroll-mt-4 xl:scroll-mt-6"
      items={entriesOf(listing, transfers, drafts, resources)}
      itemKey="key"
      manual
      pagination={listing.stage !== 'uploading'}
      total={content.total}
      page={listing.page}
      pageSize={pageSize}
      onPageChange={controls.setPage}
      loading={controls.turning}
      renderHeader={() => (
        <ListToolbar
          listing={listing}
          counts={{
            uploading: transfers.length + drafts.length,
            processing: summary.processing,
            published: summary.published,
          }}
          search={controls.draft}
          onStageChange={controls.setStage}
          onSearchChange={controls.setDraft}
          onOrderChange={controls.setOrder}
        />
      )}
      renderEmpty={() => (
        <Empty
          title={t(`empty.${emptiness}`)}
          description={emptiness === 'nothing' ? t('emptyHint') : undefined}
          size="sm"
        />
      )}
    >
      {({ item }) =>
        item.kind === 'transfer' ? (
          <TransferEntry transfer={item.transfer} />
        ) : item.kind === 'draft' ? (
          <DraftEntry draft={item.draft} />
        ) : (
          <ResourceEntry
            own={item.own}
            viewer={viewer}
            composition={content.compositions.find(
              composition => composition.resource_id === item.own.resource.id,
            )}
          />
        )
      }
    </DataList>
  )
}
