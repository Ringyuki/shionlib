import { Stack, Tag, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { ErrorTag } from '~/features/admin-ai'
import type { Logged } from '../admin-ai-request'

type RequestStatusProps = {
  request: Logged
  note?: string
}

export function RequestStatus({ request, note }: RequestStatusProps) {
  const t = useTranslations('adminAiRequest')
  return (
    <Stack gap="xs" className="items-start">
      {request.ok ? (
        <Tag tone="success">{t('result.ok')}</Tag>
      ) : (
        <ErrorTag kind={request.error_kind ?? ''} />
      )}
      {note !== undefined && (
        <Text as="span" size="sm" tone="muted">
          {note}
        </Text>
      )}
    </Stack>
  )
}
