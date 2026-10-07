import { MeterGroup } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { useBytes } from '~/shared/i18n/use-bytes'

type StorageMeterProps = {
  limit: number
  stored: number
  uploading: number
  chosen: number
}

export function StorageMeter({ limit, stored, uploading, chosen }: StorageMeterProps) {
  const t = useTranslations('resource.storage')
  const bytes = useBytes()
  const used = stored + uploading + chosen
  const extra = [
    { label: t('uploading'), value: uploading, tone: 'info' },
    { label: t('chosen'), value: chosen, tone: used > limit ? 'danger' : 'success' },
  ] as const
  return (
    <MeterGroup
      label={t('label', { limit: bytes(limit) })}
      max={Math.max(limit, used)}
      items={[
        { label: t('stored'), value: stored, tone: 'accent' },
        ...extra.filter(item => item.value > 0),
      ]}
      format={value => bytes(value)}
      size="sm"
    />
  )
}
