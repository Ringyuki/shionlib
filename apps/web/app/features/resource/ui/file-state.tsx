import { Tag, Tooltip } from '@hina-ui/react'
import { CircleHelp } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { detections, fileState, type ResourceFile } from '../resource'

const tags = {
  scanning: { tone: 'neutral', variant: 'outline' },
  falsePositive: { tone: 'danger', variant: 'solid' },
  risky: { tone: 'danger', variant: 'solid' },
} as const

export function FileState({ file }: { file: ResourceFile }) {
  const t = useTranslations('resource')
  const state = fileState(file)
  if (state === 'passed') {
    return null
  }
  return (
    <Tag size="sm" className="shrink-0" {...tags[state]}>
      {t(`state.${state}`)}
      <Tooltip content={t(`stateHint.${state}`, { names: detections(file).join(', ') })}>
        <CircleHelp role="img" aria-label={t('stateHelp')} tabIndex={0} className="cursor-help" />
      </Tooltip>
    </Tag>
  )
}
