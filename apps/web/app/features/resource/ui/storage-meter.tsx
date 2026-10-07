import { Inline, MeterGroup, Stack, Text } from '@hina-ui/react'
import { useId } from 'react'
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
  const label = useId()
  const used = stored + uploading + chosen
  const extra = [
    { label: t('uploading'), value: uploading, tone: 'info' },
    { label: t('chosen'), value: chosen, tone: used > limit ? 'danger' : 'success' },
  ] as const
  return (
    <Stack gap="sm">
      <Inline gap="md" align="baseline" justify="between" wrap={false}>
        <Text id={label} size="sm">
          {t('label')}
        </Text>
        <Text size="sm" tone={used > limit ? 'danger' : 'muted'} className="tabular-nums">
          {t('usage', { used: bytes(used), limit: bytes(limit) })}
        </Text>
      </Inline>
      <MeterGroup
        aria-labelledby={label}
        max={Math.max(limit, used)}
        items={[
          { label: t('stored'), value: stored, tone: 'accent' },
          ...extra.filter(item => item.value > 0),
        ]}
        format={value => bytes(value)}
        size="sm"
      />
    </Stack>
  )
}
