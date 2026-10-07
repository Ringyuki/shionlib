import { IconButton, Inline, Progress, Stack, Text, Tooltip } from '@hina-ui/react'
import { Pause, Play, X } from 'lucide-react'
import { useFormatter, useTranslations } from 'use-intl'
import { useBytes } from '~/shared/i18n/use-bytes'
import { useOverflowing } from '~/shared/ui/use-overflowing'
import { remainingSeconds, type Upload } from '../upload'
import { useUploadManager } from '../use-uploads'

const tones = {
  queued: 'accent',
  needsFile: 'warning',
  running: 'accent',
  waiting: 'warning',
  paused: 'accent',
  done: 'success',
  failed: 'danger',
} as const

export function UploadRow({ upload, removable }: { upload: Upload; removable: boolean }) {
  const t = useTranslations('upload')
  const manager = useUploadManager()
  const { ref, overflowing } = useOverflowing<HTMLParagraphElement>()
  const status = useStatusText(upload)
  const { phase } = upload
  const pausable = phase.name === 'running' || phase.name === 'queued' || phase.name === 'waiting'
  return (
    <Stack gap="xs">
      <Inline gap="xs" align="center" wrap={false}>
        <Tooltip content={upload.name ?? upload.file.name} disabled={!overflowing}>
          <Text ref={ref} size="sm" weight="medium" truncate className="w-fit min-w-0 flex-1">
            {upload.name ?? upload.file.name}
          </Text>
        </Tooltip>
        {pausable && (
          <IconButton label={t('pause')} size="sm" onClick={() => manager?.pause(upload.id)}>
            <Pause />
          </IconButton>
        )}
        {phase.name === 'paused' && (
          <IconButton label={t('resume')} size="sm" onClick={() => manager?.resume(upload.id)}>
            <Play />
          </IconButton>
        )}
        {removable && (
          <IconButton label={t('cancel')} size="sm" onClick={() => manager?.cancel(upload.id)}>
            <X />
          </IconButton>
        )}
      </Inline>
      <Progress
        size="sm"
        tone={tones[phase.name]}
        value={upload.file.size === 0 ? 0 : (upload.sent / upload.file.size) * 100}
      />
      <Text size="xs" tone={phase.name === 'failed' ? 'danger' : 'muted'}>
        {status}
      </Text>
    </Stack>
  )
}

function useStatusText(upload: Upload): string {
  const t = useTranslations('upload')
  const format = useFormatter()
  const bytes = useBytes()
  const { phase } = upload
  const amount = t('total', { sent: bytes(upload.sent), size: bytes(upload.file.size) })
  switch (phase.name) {
    case 'running': {
      const seconds = remainingSeconds(upload)
      const parts = [amount]
      if (upload.speed > 0) {
        parts.push(t('speed', { speed: bytes(upload.speed) }))
      }
      if (seconds !== undefined) {
        const [value, unit] =
          seconds < 90
            ? [seconds, 'second']
            : seconds < 5400
              ? [seconds / 60, 'minute']
              : [seconds / 3600, 'hour']
        const time = format.number(value, {
          style: 'unit',
          unit,
          unitDisplay: 'short',
          maximumFractionDigits: 0,
        })
        parts.push(t('remaining', { time }))
      }
      return parts.join(' · ')
    }
    case 'waiting':
      return t(`wait.${phase.reason}`)
    case 'failed':
      return phase.message ?? t(`failure.${phase.reason}`)
    default:
      return `${t(`phase.${phase.name}`)} · ${amount}`
  }
}
