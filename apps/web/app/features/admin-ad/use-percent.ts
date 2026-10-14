import { useFormatter } from 'use-intl'

export function usePercent() {
  const format = useFormatter()
  return (rate: number) => format.number(rate, { style: 'percent', maximumFractionDigits: 1 })
}
