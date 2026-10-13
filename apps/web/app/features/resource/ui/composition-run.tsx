import { Alert, Stack } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { runRefreshEvery, runStatus, type Composition } from '../resource-composition'
import { useComposerRefresh } from '../use-composer-refresh'
import { CompositionRecovery } from './composition-recovery'
import { CompositionSteps } from './composition-steps'

type CompositionRunProps = { composition: Composition; previous: string | null }

export function CompositionRun({ composition, previous }: CompositionRunProps) {
  const t = useTranslations('resource.composition')
  const status = runStatus(composition) ?? 'running'
  const failed = status === 'failed'
  useComposerRefresh(!failed, runRefreshEvery)
  const reason = composition.failure === null ? '' : t(`failure.${composition.failure}`)
  const version = composition.details.patch_version
  const message = composition.rebuild
    ? failed
      ? t('notice.rebuildFailed', { reason })
      : version !== null && previous !== null
        ? t('notice.rebuilding', { version, previous })
        : t('notice.rebuildingPlain')
    : t(`notice.${status}`, { reason })
  return (
    <Stack gap="md">
      <Alert
        tone={failed ? 'danger' : 'info'}
        open
        actions={failed ? <CompositionRecovery composition={composition} /> : undefined}
      >
        {message}
      </Alert>
      {!composition.rebuild && <CompositionSteps composition={composition} />}
    </Stack>
  )
}
