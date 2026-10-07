import { useFormatter } from 'use-intl'
import { byteSize } from './bytes'

export function useBytes(): (bytes: number) => string {
  const format = useFormatter()
  return bytes => {
    const size = byteSize(bytes)
    const digits = size.unit === 'B' ? 0 : 2
    return `${format.number(size.value, { maximumFractionDigits: digits })} ${size.unit}`
  }
}
