import { IconButton, Inline, Popconfirm, Spinner } from '@hina-ui/react'
import { Pause, Play, X } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { pausable, useUploadManager } from '~/features/upload'
import type { Transfer } from '../uploader'
import { Reselect } from './reselect'

export function TransferControls({ transfer }: { transfer: Transfer }) {
  const t = useTranslations('uploader.transfers')
  const manager = useUploadManager()
  const { submission, uploads } = transfer
  const { phase } = submission
  const running = uploads.filter(pausable)
  const paused = uploads.filter(upload => upload.phase.name === 'paused')
  const waiting = uploads.some(upload => upload.phase.name === 'needsFile')
  const several = uploads.length > 1
  if (phase.name === 'submitting' || phase.name === 'submitted') {
    return (
      <Inline align="center" justify="center" className="h-7 w-14">
        <Spinner size="sm" label={t('submitting')} />
      </Inline>
    )
  }
  return (
    <Inline gap="none" align="center" wrap={false}>
      <Inline align="center" justify="center" className="size-7">
        {running.length > 0 ? (
          <IconButton
            label={t('pause')}
            size="sm"
            onClick={() => running.forEach(upload => manager?.pause(upload.id))}
          >
            <Pause />
          </IconButton>
        ) : paused.length > 0 ? (
          <IconButton
            label={t('resume')}
            size="sm"
            onClick={() => paused.forEach(upload => manager?.resume(upload.id))}
          >
            <Play />
          </IconButton>
        ) : (
          waiting && <Reselect compact />
        )}
      </Inline>
      <Inline align="center" justify="center" className="size-7">
        <Popconfirm
          title={t(several ? 'cancelAllConfirm' : 'cancelConfirm')}
          description={t('cancelHint')}
          tone="danger"
          align="end"
          onConfirm={() => manager?.dismiss(submission.id)}
        >
          <IconButton label={t(several ? 'cancelAll' : 'cancelUpload')} size="sm">
            <X />
          </IconButton>
        </Popconfirm>
      </Inline>
    </Inline>
  )
}
