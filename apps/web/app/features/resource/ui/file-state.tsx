import { Tag, Tooltip } from '@hina-ui/react'
import { CircleHelp, ShieldCheck } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { detections, fileState, type FileState as State, type ResourceFile } from '../resource'

const tags = {
  scanning: { tone: 'neutral', variant: 'outline' },
  falsePositive: { tone: 'danger', variant: 'solid' },
  risky: { tone: 'danger', variant: 'solid' },
} as const satisfies Record<Exclude<State, 'passed'>, object>

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
  return (
    <Tag size="sm" {...tags[state]}>
      {t(`state.${state}`)}
      <Tooltip content={hint}>
        <CircleHelp role="img" aria-label={t('stateHelp')} tabIndex={0} className="cursor-help" />
      </Tooltip>
    </Tag>
  )
}
