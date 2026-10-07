import {
  Alert,
  Divider,
  FileUpload,
  Inline,
  Progress,
  ScrollArea,
  Stack,
  Text,
  toast,
} from '@hina-ui/react'
import { Fragment } from 'react'
import { useTranslations } from 'use-intl'
import { useBytes } from '~/shared/i18n/use-bytes'
import { chosenFiles, totals, type UploadState } from '../upload'
import { uploadsOf } from '../upload-state'
import { useUploadManager } from '../use-uploads'
import { UploadSubmission } from './upload-submission'

export function UploadPanel({ state }: { state: UploadState }) {
  const t = useTranslations('upload')
  const manager = useUploadManager()
  const bytes = useBytes()
  const total = totals(state.uploads)
  const waiting = state.uploads.filter(upload => upload.phase.name === 'needsFile')
  const attach = (value: File | File[] | null) => {
    const unmatched = manager?.attach(chosenFiles(value)) ?? []
    if (unmatched.length > 0) {
      toast.warning(t('unmatched', { names: unmatched.map(file => file.name).join('、') }))
    }
  }
  return (
    <Stack gap="md" className="w-[min(20rem,calc(100vw-4rem))]">
      <Stack gap="xs">
        <Inline gap="sm" align="center" justify="between">
          <Text weight="semibold">{t('tray')}</Text>
          <Text size="sm" tone="muted">
            {t('total', { sent: bytes(total.sent), size: bytes(total.size) })}
          </Text>
        </Inline>
        <Progress size="sm" value={total.ratio * 100} />
      </Stack>
      <Alert tone="warning" open={waiting.length > 0}>
        <Stack gap="sm">
          <Text size="sm">
            {t('chooseAgainHint', { names: waiting.map(upload => upload.file.name).join('、') })}
          </Text>
          <FileUpload variant="button" multiple list={false} value={[]} onValueChange={attach}>
            {t('chooseAgain')}
          </FileUpload>
        </Stack>
      </Alert>
      <ScrollArea className="max-h-[55vh]">
        <Stack gap="md">
          {state.submissions.map((submission, index) => (
            <Fragment key={submission.id}>
              {index > 0 && <Divider />}
              <UploadSubmission submission={submission} uploads={uploadsOf(state, submission.id)} />
            </Fragment>
          ))}
        </Stack>
      </ScrollArea>
    </Stack>
  )
}
