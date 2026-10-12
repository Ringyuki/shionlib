import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
  Stack,
  Text,
  Time,
} from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { ErrorTag, missing, protocolName, useAiFormat, type SceneName } from '~/features/admin-ai'
import type { LoggedDetail } from '../admin-ai-request'
import { useRequestText } from '../use-request-text'

type RequestFactsProps = {
  detail: LoggedDetail
  scenes: SceneName[]
}

export function RequestFacts({ detail, scenes }: RequestFactsProps) {
  const t = useTranslations('adminAiRequest')
  const format = useAiFormat()
  const text = useRequestText(scenes)
  const usage = [
    detail.input_tokens > 0 && t('usage.input', { count: detail.input_tokens }),
    detail.output_tokens > 0 && t('usage.output', { count: detail.output_tokens }),
    detail.reasoning_tokens > 0 && t('usage.reasoning', { count: detail.reasoning_tokens }),
    detail.cache_read_tokens > 0 && t('usage.cacheRead', { count: detail.cache_read_tokens }),
    detail.cache_write_tokens > 0 && t('usage.cacheWrite', { count: detail.cache_write_tokens }),
  ].filter(part => part !== false)
  return (
    <DescriptionList orientation="horizontal" className="text-sm [--hn-dl-term-width:5rem]">
      <DescriptionTerm>{t('fact.time')}</DescriptionTerm>
      <DescriptionDetails>
        <Time value={detail.created} format="datetime" tooltip={false} />
      </DescriptionDetails>
      <DescriptionTerm>{t('fact.source')}</DescriptionTerm>
      <DescriptionDetails>
        {text.source(detail)}
        {detail.source === 'scene' && detail.scene !== null && (
          <Text as="span" size="inherit" tone="muted" className="ms-2 font-mono">
            {detail.scene}
          </Text>
        )}
      </DescriptionDetails>
      <DescriptionTerm>{t('fact.model')}</DescriptionTerm>
      <DescriptionDetails>
        {t('fact.route', {
          model: detail.model?.name ?? detail.upstream_id,
          provider: detail.provider?.name ?? t('fact.removedProvider'),
          protocol: protocolName(detail.protocol),
        })}
      </DescriptionDetails>
      <DescriptionTerm>{t('fact.usage')}</DescriptionTerm>
      <DescriptionDetails className="tabular-nums">
        {usage.length === 0 ? missing : usage.join(t('dot'))}
      </DescriptionDetails>
      <DescriptionTerm>{t('fact.cost')}</DescriptionTerm>
      <DescriptionDetails className="tabular-nums">
        {format.usdFine(detail.cost_usd)}
      </DescriptionDetails>
      <DescriptionTerm>{t('fact.took')}</DescriptionTerm>
      <DescriptionDetails className="tabular-nums">{text.took(detail)}</DescriptionDetails>
      {!detail.ok && (
        <>
          <DescriptionTerm>{t('fact.error')}</DescriptionTerm>
          <DescriptionDetails>
            <Stack gap="xs" className="items-start">
              <ErrorTag kind={detail.error_kind ?? ''} />
              <Text as="span" size="inherit" className="break-all">
                {detail.error_message}
              </Text>
              {detail.error_detail !== null && detail.error_detail !== detail.error_message && (
                <Text as="span" size="inherit" tone="muted" className="font-mono break-all">
                  {detail.error_detail}
                </Text>
              )}
            </Stack>
          </DescriptionDetails>
        </>
      )}
      {detail.finish_reason !== null && (
        <>
          <DescriptionTerm>{t('fact.finish')}</DescriptionTerm>
          <DescriptionDetails className="font-mono">{detail.finish_reason}</DescriptionDetails>
        </>
      )}
    </DescriptionList>
  )
}
