import { useFormatter, useTranslations } from 'use-intl'
import { knownMethod } from './admin-sponsor'

const dollars = { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' } as const

export function useAmount(): (amount: number) => string {
  const format = useFormatter()
  return amount => format.number(amount, dollars)
}

export function useMethodName(): (method: string) => string {
  const t = useTranslations('adminSponsor.method')
  return method => {
    const known = knownMethod(method)
    return known === undefined ? method : t(known)
  }
}
