import { Tag, Text, Tooltip } from '@hina-ui/react'
import { CircleHelp } from 'lucide-react'
import { useFormatter, useTranslations } from 'use-intl'
import { progress, type Upload } from '~/features/upload'
import { FailureNote } from './failure-note'
import { Reselect } from './reselect'

const tags = {
  queued: { tone: 'neutral', variant: 'outline' },
  running: { tone: 'accent', variant: 'soft' },
  waiting: { tone: 'warning', variant: 'soft' },
  paused: { tone: 'neutral', variant: 'soft' },
  heldElsewhere: { tone: 'neutral', variant: 'soft' },
  done: { tone: 'success', variant: 'soft' },
  failed: { tone: 'danger', variant: 'soft' },
} as const

export function UploadTag({ upload, onReselect }: { upload: Upload; onReselect: () => void }) {
  const t = useTranslations('uploader.transfers')
  const format = useFormatter()
  const { phase } = upload
  if (phase.name === 'needsFile') {
    return <Reselect onOpen={onReselect} />
  }
  const percent = (
    <Text as="span" className="inline-block min-w-[4ch] text-center tabular-nums">
      {format.number(progress(upload) / 100, { style: 'percent', maximumFractionDigits: 0 })}
    </Text>
  )
  if (phase.name === 'running') {
    return (
      <Tag size="sm" className="shrink-0" {...tags.running}>
        {percent}
      </Tag>
    )
  }
  const hint =
    phase.name === 'waiting' ? (
      t(`wait.${phase.reason}`)
    ) : phase.name === 'failed' ? (
      <FailureNote text={phase.message ?? t(`failure.${phase.reason}`)} error={phase.error} />
    ) : phase.name === 'heldElsewhere' ? (
      t('elsewhere.file')
    ) : undefined
  return (
    <Tag size="sm" className="shrink-0" {...tags[phase.name]}>
      {phase.name === 'heldElsewhere' ? percent : t(`state.${phase.name}`)}
      {hint !== undefined && (
        <Tooltip content={hint}>
          <CircleHelp role="img" aria-label={t('stateHelp')} tabIndex={0} className="cursor-help" />
        </Tooltip>
      )}
    </Tag>
  )
}
