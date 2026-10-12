import { useFormatter, useTranslations } from 'use-intl'
import { failureRate, type Stats } from './admin-ai'

export const missing = '—'

const dollars = { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' } as const

const second = 1000

const cent = 0.01

const fine = { minimumFractionDigits: 4, maximumFractionDigits: 4 } as const

export function useAiFormat() {
  const format = useFormatter()
  const t = useTranslations('adminAi.unit')
  const share = (value: number) =>
    format.number(value, { style: 'percent', maximumFractionDigits: 1 })
  const latency = (ms: number) => t('ms', { value: format.number(ms) })
  return {
    count: (value: number) => format.number(value),
    share,
    rate: (stats: Pick<Stats, 'requests' | 'failures'>) => {
      const rate = failureRate(stats)
      return rate === undefined ? missing : share(rate)
    },
    usd: (value: number) =>
      format.number(
        value,
        value !== 0 && Math.abs(value) < cent ? { ...dollars, ...fine } : dollars,
      ),
    usdFine: (value: number) =>
      format.number(value, { ...dollars, ...fine, maximumFractionDigits: 6 }),
    price: (value: number) =>
      format.number(value, { ...dollars, minimumFractionDigits: 2, maximumFractionDigits: 4 }),
    latency: (ms: number | null) => (ms === null ? missing : latency(ms)),
    duration: (ms: number) =>
      ms < second
        ? latency(ms)
        : t('s', {
            value: format.number(ms / second, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }),
          }),
  }
}
