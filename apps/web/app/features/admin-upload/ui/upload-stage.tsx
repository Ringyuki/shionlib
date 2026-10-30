import { Stack, Tag, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { detached, percentOf, type UploadItem, type UploadStage } from '../admin-upload'

const tones = {
  not_started: 'danger',
  uploading: 'info',
  pending: 'warning',
  processing: 'info',
  published: 'success',
  composed: 'info',
  rejected: 'danger',
  canceled: 'neutral',
  expired: 'neutral',
} as const satisfies Record<UploadStage, string>

export function StageTag({ stage }: Pick<UploadItem, 'stage'>) {
  const t = useTranslations('adminUpload')
  return <Tag tone={tones[stage]}>{t(`stage.${stage}`)}</Tag>
}

export function useStageNote() {
  const t = useTranslations('adminUpload')
  return (item: UploadItem): string | undefined => {
    switch (item.stage) {
      case 'uploading':
        return t('progress', {
          percent: percentOf(item),
          received: item.received,
          chunks: item.chunks,
        })
      case 'canceled':
      case 'expired':
        return item.chunks === 0
          ? undefined
          : t('received', { received: item.received, chunks: item.chunks })
      case 'processing':
        return item.file_stage === null ? undefined : t(`fileStage.${item.file_stage}`)
      case 'rejected':
        return item.rejection === null ? undefined : t(`rejection.${item.rejection}`)
      case 'published':
        return detached(item) ? t('detached') : undefined
      default:
        return undefined
    }
  }
}

export function StageCell({ item }: { item: UploadItem }) {
  const note = useStageNote()(item)
  return (
    <Stack gap="none" className="items-start">
      <StageTag stage={item.stage} />
      {note !== undefined && (
        <Text as="span" size="sm" tone="muted" className="tabular-nums">
          {note}
        </Text>
      )}
    </Stack>
  )
}
