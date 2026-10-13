import { Empty } from '@hina-ui/react'
import { SearchX } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { topTotal, type Contents, type Inspection } from '../inspection'
import { usePreviews } from '../use-previews'
import { ContentsToolbar } from './contents-toolbar'
import { EntryTree } from './entry-tree'
import { ImagePreview } from './image-preview'
import { TextPreview } from './text-preview'

type ContentsListingProps = {
  inspection: Inspection
  contents: Contents
  draft: string
  searching: boolean
  onDraftChange: (draft: string) => void
}

export function ContentsListing({
  inspection,
  contents,
  draft,
  searching,
  onDraftChange,
}: ContentsListingProps) {
  const t = useTranslations('inspection.contents')
  const previews = usePreviews()
  const { view } = contents
  const matches = topTotal(contents.branches)
  return (
    <>
      <ContentsToolbar
        inspection={inspection}
        query={view.query}
        matches={matches}
        draft={draft}
        searching={searching}
        onDraftChange={onDraftChange}
      />
      {view.query !== '' && matches === 0 ? (
        <Empty icon={<SearchX />} title={t('noMatches', { query: view.query })} />
      ) : (
        <EntryTree
          key={`${view.inspectionId}:${view.query}`}
          contents={contents}
          onOpen={previews.open}
        />
      )}
      <TextPreview
        open={previews.text.open}
        onClose={previews.close}
        opened={previews.opened}
        preview={previews.text.preview}
        loading={previews.text.loading}
      />
      <ImagePreview
        open={previews.image.open}
        onClose={previews.close}
        images={previews.opened?.images ?? []}
        index={previews.image.index}
        onIndexChange={previews.image.setIndex}
      />
    </>
  )
}
