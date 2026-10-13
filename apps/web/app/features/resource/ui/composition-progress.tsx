import { Inline, Progress, Stack, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { runStatus, runningStep, type Composition } from '../resource-composition'
import { CompositionRecovery } from './composition-recovery'

export function CompositionProgress({ composition }: { composition: Composition }) {
  const t = useTranslations('resource.composition')
  const status = runStatus(composition)
  if (status === 'failed') {
    return (
      <Stack gap="sm">
        <Text size="sm">{t(`failure.${composition.failure ?? 'internal'}`)}</Text>
        <CompositionRecovery composition={composition} />
      </Stack>
    )
  }
  const running = runningStep(composition)
  if (status !== 'running' || running === undefined) {
    return (
      <Text size="sm" tone="muted">
        {t('ahead', { count: composition.ahead })}
      </Text>
    )
  }
  return (
    <Inline className="max-w-md">
      <Progress
        size="sm"
        className="w-full"
        label={t('progress', {
          step: t(`stepName.${running.step}`),
          at: running.at,
          total: running.total,
        })}
        value={composition.percent > 0 ? composition.percent : null}
        showValue={composition.percent > 0}
      />
    </Inline>
  )
}
