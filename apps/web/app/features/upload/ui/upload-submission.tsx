import { Button, Inline, Spinner, Stack, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { Submission, Upload } from '../upload'
import { useUploadManager } from '../use-uploads'
import { UploadRow } from './upload-row'

type UploadSubmissionProps = {
  submission: Submission
  uploads: readonly Upload[]
}

export function UploadSubmission({ submission, uploads }: UploadSubmissionProps) {
  const t = useTranslations('upload')
  const manager = useUploadManager()
  const { phase, target } = submission
  const title =
    target.kind === 'orphan'
      ? t('target.orphan')
      : t(`target.${target.kind}`, { label: submission.label })
  const settled = phase.name === 'submitted' || phase.name === 'failed'
  const dismiss = (
    <Button
      size="sm"
      variant="ghost"
      tone="neutral"
      onClick={() => manager?.dismiss(submission.id)}
    >
      {t('dismiss')}
    </Button>
  )
  return (
    <Stack gap="sm">
      <Inline gap="sm" align="center" wrap={false}>
        <Text size="sm" weight="semibold" truncate className="min-w-0 flex-1">
          {title}
        </Text>
        {phase.name === 'submitting' && <Spinner size="sm" label={t('submission.submitting')} />}
        {phase.name === 'submitted' && (
          <>
            <Text size="xs" tone="success">
              {t('submission.submitted')}
            </Text>
            {dismiss}
          </>
        )}
      </Inline>
      {target.kind === 'orphan' && (
        <Text size="xs" tone="muted">
          {t('orphanHint')}
        </Text>
      )}
      {phase.name !== 'submitted' &&
        uploads.map(upload => <UploadRow key={upload.id} upload={upload} removable={!settled} />)}
      {phase.name === 'failed' && (
        <Inline gap="xs" align="center" wrap={false}>
          <Text size="xs" tone="danger" className="min-w-0 flex-1">
            {phase.message ?? t('submission.failed')}
          </Text>
          <Button size="sm" variant="soft" onClick={() => manager?.retrySubmission(submission.id)}>
            {t('retry')}
          </Button>
          {dismiss}
        </Inline>
      )}
    </Stack>
  )
}
