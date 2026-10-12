import { Empty, Stack } from '@hina-ui/react'
import { Clock, File, LoaderCircle, TriangleAlert } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { unreadState, type Contents, type InspectedFile, type Inspection } from '../inspection'
import { useContentsView } from '../use-contents-view'
import { ContentsListing } from './contents-listing'
import { FileChoice } from './file-choice'

type ContentsTabProps = {
  inspections: readonly Inspection[]
  files: readonly InspectedFile[]
  contents: Contents | null
}

export function ContentsTab({ inspections, files, contents }: ContentsTabProps) {
  const t = useTranslations('inspection.contents')
  const view = contents?.view
  const { draft, setDraft, searching, chooseFile } = useContentsView(view, inspections[0]?.id)
  const inspection = inspections.find(candidate => candidate.id === view?.inspectionId)
  if (contents === null || inspection === undefined) {
    const state = unreadState(files)
    if (state === 'reading') {
      return <Empty icon={<LoaderCircle />} title={t('reading')} />
    }
    if (state === 'waiting') {
      return <Empty icon={<Clock />} title={t('waiting')} />
    }
    return state === 'failed' ? (
      <Empty icon={<TriangleAlert />} title={t('failed')} />
    ) : (
      <Empty icon={<Clock />} title={t('unread')} description={t('unreadHint')} />
    )
  }
  return (
    <Stack gap="md">
      {inspections.length > 1 && (
        <FileChoice
          inspections={inspections}
          files={files}
          chosen={inspection.id}
          onChoose={chooseFile}
        />
      )}
      {inspection.status === 'failed' && <Empty icon={<TriangleAlert />} title={t('failed')} />}
      {inspection.status === 'plain' && <Empty icon={<File />} title={t('plain')} />}
      {inspection.status === 'ready' && (
        <ContentsListing
          inspection={inspection}
          contents={contents}
          draft={draft}
          searching={searching}
          onDraftChange={setDraft}
        />
      )}
    </Stack>
  )
}
