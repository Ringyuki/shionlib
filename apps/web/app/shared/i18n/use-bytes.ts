import { useFormatter } from 'use-intl'
import { byteSize, shortFractionDigits } from './bytes'

export function useBytes(precision: 'full' | 'short' = 'full'): (bytes: number) => string {
  const format = useFormatter()
  return bytes => {
    const size = byteSize(bytes)
    const full = size.unit === 'B' ? 0 : 2
    const digits = precision === 'short' ? Math.min(full, shortFractionDigits(size.value)) : full
    return `${format.number(size.value, { maximumFractionDigits: digits })} ${size.unit}`
  }
}
