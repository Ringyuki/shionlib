import { Alert, Inline, Text } from '@hina-ui/react'
import { Gauge } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { useUploadManager } from '~/features/upload'
import { Button } from '~/shared/ui/button'
import type { Transfer } from '../uploader'
import { usePace } from '../use-pace'
import { EntryShell } from './entry-shell'
import { Fact } from './fact'
import { StageTag } from './stage-tag'
import { TransferControls } from './transfer-controls'
import { TransferFile } from './transfer-file'
import { TransferSubject } from './transfer-subject'

export function TransferEntry({ transfer }: { transfer: Transfer }) {
  const t = useTranslations('uploader.transfers')
  const manager = useUploadManager()
  const pace = usePace(transfer.uploads)
  const { submission, uploads } = transfer
  const { phase, target } = submission
  const label = target.kind === 'orphan' ? t('orphan') : submission.label
  return (
    <EntryShell
      as="section"
      label={label}
      files={uploads.map(upload => (
        <TransferFile key={upload.id} upload={upload} />
      ))}
      stage={<StageTag stage="uploading" />}
      controls={<TransferControls transfer={transfer} />}
      controlSlots={2}
      notice={
        <Alert tone="danger" open={phase.name === 'failed'} className="col-span-2">
          <Inline gap="sm" align="center" justify="between">
            <Text size="sm">
              {(phase.name === 'failed' ? phase.message : undefined) ?? t('submitFailed')}
            </Text>
            <Button
              size="sm"
              variant="soft"
              onClick={() => manager?.retrySubmission(submission.id)}
            >
              {t('retry')}
            </Button>
          </Inline>
        </Alert>
      }
      facts={
        <>
          <TransferSubject submission={submission} />
          {pace !== undefined && <Fact icon={Gauge}>{pace}</Fact>}
        </>
      }
    />
  )
}
