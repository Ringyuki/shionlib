import { useFormatter, useTranslations } from 'use-intl'
import type { Method } from './sponsor'
import { isCurrencyCode } from './sponsor.schema'

const dollars = { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' } as const

export function useAmount(): (amount: number) => string {
  const format = useFormatter()
  return amount => format.number(amount, dollars)
}

export function usePaidAmount(): (amount: number, currency: string) => string {
  const format = useFormatter()
  return (amount, currency) =>
    isCurrencyCode(currency)
      ? format.number(amount, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
      : `${format.number(amount, { maximumFractionDigits: 8 })} ${currency}`
}

export function useMethodName(): (method: Pick<Method, 'name' | 'brand'>) => string {
  const t = useTranslations('sponsor.method')
  return method => (method.brand === null ? method.name : t(method.brand))
}
