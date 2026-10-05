import { Tag, Tooltip } from '@hina-ui/react'
import { Loader, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { detections, fileState, type ResourceFile } from '../resource'

export function FileState({ file }: { file: ResourceFile }) {
  const t = useTranslations('resource')
  const state = fileState(file)
  const hint = t(`stateHint.${state}`, { names: detections(file).join(', ') })
  if (state === 'passed') {
    return (
      <Tooltip content={hint}>
        <ShieldCheck
          role="img"
          aria-label={t('state.passed')}
          tabIndex={0}
          className="size-4 shrink-0 text-success-text"
        />
      </Tooltip>
    )
  }
  const tone = state === 'risky' ? 'danger' : state === 'falsePositive' ? 'warning' : 'neutral'
  return (
    <Tooltip content={hint}>
      <Tag size="sm" tone={tone} tabIndex={0}>
        {state === 'scanning' ? <Loader aria-hidden /> : <ShieldAlert aria-hidden />}
        {t(`state.${state}`)}
      </Tag>
    </Tooltip>
  )
}
