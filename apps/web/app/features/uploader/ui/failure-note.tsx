import { Stack } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { ErrorReport } from '~/features/upload'

export function FailureNote({ text, error }: { text: string; error: ErrorReport | undefined }) {
  return (
    <Stack as="span" gap="xs">
      <Stack as="span">{text}</Stack>
      {error !== undefined && <ErrorFacts error={error} />}
    </Stack>
  )
}

function ErrorFacts({ error }: { error: ErrorReport }) {
  const t = useTranslations('uploader.transfers.facts')
  const facts =
    error.name === 'ApiError'
      ? [
          ...(error.status === undefined ? [] : [t('status', { status: error.status })]),
          ...(error.code === undefined || error.code === error.status
            ? []
            : [t('code', { code: error.code })]),
          ...(error.request_id === undefined ? [] : [t('request', { id: error.request_id })]),
          ...(error.ray === undefined ? [] : [t('ray', { id: error.ray })]),
        ]
      : [error.message === '' ? error.name : `${error.name}: ${error.message}`]
  return (
    <Stack as="span" className="break-words">
      {facts.join(' · ')}
    </Stack>
  )
}
