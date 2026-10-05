import { Tag, Tooltip } from '@hina-ui/react'
import { CircleHelp } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { detections, fileState, type ResourceFile } from '../resource'

const tags = {
  passed: { tone: 'success', variant: 'soft' },
  scanning: { tone: 'neutral', variant: 'outline' },
  falsePositive: { tone: 'danger', variant: 'solid' },
  risky: { tone: 'danger', variant: 'solid' },
} as const

export function FileState({ file }: { file: ResourceFile }) {
  const t = useTranslations('resource')
  const state = fileState(file)
  return (
    <Tag size="sm" {...tags[state]}>
      {t(`state.${state}`)}
      {state !== 'passed' && (
        <Tooltip content={t(`stateHint.${state}`, { names: detections(file).join(', ') })}>
          <CircleHelp role="img" aria-label={t('stateHelp')} tabIndex={0} className="cursor-help" />
        </Tooltip>
      )}
    </Tag>
  )
}
