import { Inline, SearchInput, Text } from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import { useBytes } from '~/shared/i18n/use-bytes'
import type { Inspection } from '../inspection'

type ContentsToolbarProps = {
  inspection: Inspection
  query: string
  matches: number
  draft: string
  searching: boolean
  onDraftChange: (draft: string) => void
}

export function ContentsToolbar({
  inspection,
  query,
  matches,
  draft,
  searching,
  onDraftChange,
}: ContentsToolbarProps) {
  const t = useTranslations('inspection.contents')
  const format = useFormatter()
  const bytes = useBytes()
  const summary =
    query === ''
      ? t('summary', {
          files: inspection.files,
          folders: inspection.folders,
          size: bytes(inspection.size),
          discFiles: inspection.disc_files,
        })
      : t('matches', { count: format.number(matches) })
  return (
    <Inline gap="md" align="center" className="gap-y-2">
      <Text size="sm" tone="muted" className="min-w-0 flex-1 basis-64 tabular-nums">
        {summary}
        {query === '' && inspection.truncated && t('truncated')}
      </Text>
      <SearchInput
        value={draft}
        onValueChange={onDraftChange}
        loading={searching}
        placeholder={t('filter')}
        aria-label={t('filter')}
        className="w-70 max-sm:w-full"
      />
    </Inline>
  )
}
