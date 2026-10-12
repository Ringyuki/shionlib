import { useTranslations } from 'use-intl'
import { failureRate, type Range } from '../admin-ai'
import { changeOf, type Usage } from '../admin-ai-overview'
import { useAiFormat } from '../use-ai-format'
import { StatFigures } from './stat-figures'

type OverviewFiguresProps = {
  usage: Usage
  range: Range
}

export function OverviewFigures({ usage, range }: OverviewFiguresProps) {
  const t = useTranslations('adminAi')
  const format = useAiFormat()
  const { current, previous } = usage
  const span = t(`range.${range}`)
  const change = changeOf(current.requests, previous.requests)
  const was = (value: string) => t('overview.compare.was', { range: span, value })
  const quiet = previous.requests === 0
  return (
    <StatFigures
      figures={[
        {
          label: t('stat.requests'),
          value: format.count(current.requests),
          note:
            change === undefined
              ? t('overview.compare.none', { range: span })
              : t(`overview.compare.${change.direction}`, {
                  range: span,
                  share: format.share(change.share),
                }),
        },
        {
          label: t('stat.failureRate'),
          value: format.rate(current),
          note: quiet ? undefined : was(format.rate(previous)),
          worse: (failureRate(current) ?? 0) > (failureRate(previous) ?? 0),
        },
        {
          label: t('stat.firstToken'),
          value: format.latency(current.first_token_ms),
          note:
            previous.first_token_ms === null
              ? undefined
              : was(format.latency(previous.first_token_ms)),
        },
        {
          label: t('stat.cost'),
          value: format.usd(current.cost_usd),
          note: quiet ? undefined : was(format.usd(previous.cost_usd)),
        },
      ]}
    />
  )
}
