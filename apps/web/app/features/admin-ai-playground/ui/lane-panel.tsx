import { Alert, Card, Flex, ScrollArea, Spinner, Stack, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { errorKindOf, useAiFormat } from '~/features/admin-ai'
import { totalsOf, type Exchange, type Reply } from '../admin-ai-playground'

type LanePanelProps = {
  heading: string
  exchanges: Exchange[]
  pending: boolean
}

function useFacts() {
  const t = useTranslations('adminAiPlayground.lane')
  const format = useAiFormat()
  return (reply: Reply) => {
    const { served, costUsd } = totalsOf(reply)
    if (served === undefined) {
      return ''
    }
    return [
      served.first_token_ms !== null &&
        t('firstToken', { time: format.latency(served.first_token_ms) }),
      t('total', { time: format.duration(served.duration_ms) }),
      served.input_tokens > 0 && t('input', { count: served.input_tokens }),
      served.output_tokens > 0 && t('output', { count: served.output_tokens }),
      costUsd > 0 ? format.usdFine(costUsd) : t('noCost'),
    ]
      .filter(part => part !== false)
      .join(t('dot'))
  }
}

export function LanePanel({ heading, exchanges, pending }: LanePanelProps) {
  const t = useTranslations('adminAiPlayground.lane')
  const kinds = useTranslations('adminAi.errorKind')
  const facts = useFacts()
  const last = exchanges.at(-1)?.reply
  const served = last === undefined ? undefined : totalsOf(last).served
  return (
    <Card padded={false} as="section" aria-label={heading} className="flex min-h-96 flex-col">
      <Stack gap="none" className="border-line border-b px-(--hn-panel-p) py-3">
        <Text as="span" size="sm" weight="medium" className="line-clamp-1">
          {heading}
        </Text>
        <Text as="span" size="sm" tone="muted" className="line-clamp-1">
          {served === undefined
            ? t('idle')
            : t('served', {
                model: served.model?.name ?? served.upstream_id,
                provider: served.provider?.name ?? '',
              })}
        </Text>
      </Stack>
      <ScrollArea className="max-h-128 min-h-0 flex-1">
        <Stack gap="md" className="min-h-full p-(--hn-panel-p)">
          {exchanges.map((exchange, index) => (
            <Stack key={index} gap="sm">
              {exchanges.length > 1 && (
                <Text as="span" size="sm" tone="muted" className="whitespace-pre-wrap">
                  {t('asked', { message: exchange.message })}
                </Text>
              )}
              <Alert
                tone="danger"
                open={exchange.reply?.error != null}
                title={
                  exchange.reply?.error == null
                    ? undefined
                    : kinds(errorKindOf(exchange.reply.error.kind))
                }
              >
                <Text as="span" size="inherit" className="font-mono break-all">
                  {exchange.reply?.error?.message}
                </Text>
              </Alert>
              {exchange.reply?.output != null && (
                <Text as="span" size="sm" className="font-mono break-words whitespace-pre-wrap">
                  {exchange.reply.output}
                </Text>
              )}
            </Stack>
          ))}
          {pending && (
            <Flex align="center" justify="center" className="min-h-40 flex-1">
              <Spinner label={t('waiting')} />
            </Flex>
          )}
        </Stack>
      </ScrollArea>
      <Text
        as="span"
        size="sm"
        tone="muted"
        className="border-line min-h-10 border-t px-(--hn-panel-p) py-2.5 tabular-nums"
      >
        {last === undefined ? '' : facts(last)}
      </Text>
    </Card>
  )
}
