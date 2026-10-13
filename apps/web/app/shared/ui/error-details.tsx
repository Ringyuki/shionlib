import { CodeBlock, CopyButton, Inline, Stack, Text } from '@hina-ui/react'
import { isRouteErrorResponse } from 'react-router'
import { useTranslations } from 'use-intl'
import { isFailure } from '~/shared/api/failure.schema'

export function failureOf(error: unknown) {
  return isRouteErrorResponse(error) && isFailure(error.data) ? error.data : undefined
}

export function ErrorDetails({ error }: { error: unknown }) {
  const t = useTranslations('site')
  const status = isRouteErrorResponse(error) ? error.status : undefined
  const failure = failureOf(error)
  const thrown = error instanceof Error ? error : undefined
  return (
    <Stack gap="sm" align="center" className="w-full">
      <Inline gap="md" align="center" justify="center">
        {status !== undefined && (
          <Text size="sm" tone="muted">
            {t('status', { status })}
          </Text>
        )}
        {failure !== undefined && (
          <Text size="sm" tone="muted">
            {t('errorCode', { code: failure.code })}
          </Text>
        )}
      </Inline>
      {failure !== undefined && failure.requestId !== '' && (
        <Inline gap="xs" align="center" justify="center">
          <Text size="sm" tone="muted" className="break-all">
            {t('requestId', { id: failure.requestId })}
          </Text>
          <CopyButton text={failure.requestId} label={t('copy')} />
        </Inline>
      )}
      {thrown !== undefined && (
        <CodeBlock
          code={thrown.stack ?? `${thrown.name}: ${thrown.message}`}
          label={t('errorDetails')}
          className="w-full text-start"
        />
      )}
    </Stack>
  )
}
