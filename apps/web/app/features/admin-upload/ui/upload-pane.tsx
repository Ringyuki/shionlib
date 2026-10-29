import { Alert, AlertDialog, Stack, toast } from '@hina-ui/react'
import { Ban } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { PaneSection, ReviewPane } from '~/features/admin'
import { Button } from '~/shared/ui/button'
import { useLast } from '~/shared/ui/use-last'
import {
  allReceivedUnsubmitted,
  startedBeforeFailureLog,
  terminable,
  type UploadDetail,
} from '../admin-upload'
import { useUploadTermination } from '../use-upload-termination'
import { UploadFacts } from './upload-facts'
import { UploadFailures } from './upload-failures'
import { UploadComposition } from './upload-composition'
import { UploadTarget } from './upload-target'

type UploadPaneProps = {
  opened: UploadDetail | undefined
  onClose: () => void
}

export function UploadPane({ opened, onClose }: UploadPaneProps) {
  const t = useTranslations('adminUpload')
  const shared = useTranslations('admin')
  const shown = useLast(opened)
  const termination = useUploadTermination()
  const [asking, setAsking] = useState(false)
  const notice =
    shown === undefined
      ? undefined
      : shown.kind === 'attempt'
        ? t('notice.notStarted')
        : allReceivedUnsubmitted(shown)
          ? t('notice.allReceived', { chunks: shown.chunks })
          : undefined
  return (
    <>
      <ReviewPane
        heading={t('pane.title')}
        note={shown?.file_name}
        open={opened !== undefined}
        onClose={onClose}
        renderContent={() =>
          shown === undefined ? null : (
            <Stack gap="xl">
              <Alert
                tone={shown.kind === 'attempt' ? 'info' : 'warning'}
                open={notice !== undefined}
              >
                {notice}
              </Alert>
              <PaneSection label={t('pane.facts')}>
                <UploadFacts detail={shown} />
              </PaneSection>
              {shown.target !== null && (
                <PaneSection label={t('pane.target')}>
                  <UploadTarget detail={shown} target={shown.target} />
                </PaneSection>
              )}
              {shown.composition !== null && (
                <PaneSection label={t('pane.composition')}>
                  <UploadComposition detail={shown} composition={shown.composition} />
                </PaneSection>
              )}
              <PaneSection
                label={
                  shown.failure_count === 0
                    ? t('pane.failures')
                    : `${t('pane.failures')} ${shown.failure_count}`
                }
              >
                <UploadFailures
                  failures={shown.failures ?? []}
                  beforeLog={startedBeforeFailureLog(shown)}
                />
              </PaneSection>
            </Stack>
          )
        }
        renderFooter={
          shown !== undefined && terminable(shown)
            ? () => (
                <Button
                  variant="outline"
                  tone="danger"
                  icon={<Ban />}
                  onClick={() => setAsking(true)}
                >
                  {t('terminate')}
                </Button>
              )
            : undefined
        }
      />
      <AlertDialog
        tone="danger"
        open={asking}
        onOpenChange={setAsking}
        title={t('terminateConfirm')}
        description={t('terminateDescription')}
        confirmText={t('terminate')}
        cancelText={shared('cancel')}
        onConfirm={async () => {
          if (shown === undefined) {
            return
          }
          await termination.confirm({ id: shown.id })
          toast.success(t('terminated'))
        }}
      />
    </>
  )
}
