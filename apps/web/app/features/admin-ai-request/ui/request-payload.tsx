import { CodeBlock, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { PaneSection } from '~/features/admin'
import type { LoggedDetail } from '../admin-ai-request'
import { prettyJson } from '../admin-ai-request.schema'

export function RequestPayload({ detail }: { detail: LoggedDetail }) {
  const t = useTranslations('adminAiRequest.payload')
  const { payload } = detail
  if (payload === null) {
    return (
      <PaneSection label={t('request')}>
        <Text as="span" size="sm" tone="muted">
          {t('gone')}
        </Text>
      </PaneSection>
    )
  }
  const sent = JSON.stringify(
    {
      system: payload.system,
      messages: payload.messages ?? [],
      schema: payload.schema ?? undefined,
    },
    null,
    2,
  )
  return (
    <>
      <PaneSection label={t('request')}>
        <CodeBlock code={sent} lang="json" label={t('request')} className="max-h-72" />
      </PaneSection>
      <PaneSection label={t('output')}>
        {payload.output === null || payload.output === '' ? (
          <Text as="span" size="sm" tone="muted">
            {t('noOutput')}
          </Text>
        ) : (
          <CodeBlock
            code={prettyJson(payload.output)}
            lang="json"
            label={t('output')}
            className="max-h-72"
          />
        )}
      </PaneSection>
    </>
  )
}
