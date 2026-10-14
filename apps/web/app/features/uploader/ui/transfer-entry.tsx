import { Alert, Inline, Text } from '@hina-ui/react'
import { Gauge } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { lockedElsewhere, useUploadManager } from '~/features/upload'
import { Button } from '~/shared/ui/button'
import type { Transfer } from '../uploader'
import { usePace } from '../use-pace'
import { EntryShell } from './entry-shell'
import { FailureNote } from './failure-note'
import { Fact } from './fact'
import { ReselectDialog } from './reselect'
import { StageTag } from './stage-tag'
import { TransferControls } from './transfer-controls'
import { TransferFile } from './transfer-file'
import { TransferSubject } from './transfer-subject'

export function TransferEntry({ transfer }: { transfer: Transfer }) {
  const t = useTranslations('uploader.transfers')
  const manager = useUploadManager()
  const pace = usePace(transfer.uploads)
  const [reselecting, setReselecting] = useState(false)
  const reselect = () => setReselecting(true)
  const { submission, uploads } = transfer
  const { phase, target } = submission
  const locked = lockedElsewhere(submission, uploads)
  const label =
    target.kind === 'orphan'
      ? t('orphan')
      : target.kind === 'heldElsewhere'
        ? t('elsewhere.title')
        : submission.label
  return (
    <>
      <EntryShell
        as="section"
        label={label}
        files={uploads.map(upload => (
          <TransferFile key={upload.id} upload={upload} onReselect={reselect} />
        ))}
        stage={<StageTag stage="uploading" />}
        controls={locked ? null : <TransferControls transfer={transfer} onReselect={reselect} />}
        controlSlots={locked ? 0 : 2}
        notice={
          <Alert tone="danger" open={phase.name === 'failed'} className="col-span-2">
            <Inline gap="sm" align="center" justify="between">
              <Text as="div" size="sm">
                <FailureNote
                  text={(phase.name === 'failed' ? phase.message : undefined) ?? t('submitFailed')}
                  error={phase.name === 'failed' ? phase.error : undefined}
                />
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
      <ReselectDialog open={reselecting} onOpenChange={setReselecting} />
    </>
  )
}
