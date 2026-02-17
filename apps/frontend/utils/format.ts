type ByteUnit = 'B' | 'KB' | 'MB' | 'GB' | 'TB' | 'auto'

interface FormatBytesOptions {
  unit?: ByteUnit
  decimals?: number
  format?: boolean
}

interface FormatNumberOptions {
  locale?: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

export function formatBytes(
  bytes: number,
  { unit = 'auto', decimals = 1, format = true }: FormatBytesOptions = {},
): string {
  if (!Number.isFinite(bytes)) return '0 B'
  const units: ByteUnit[] = ['B', 'KB', 'MB', 'GB', 'TB']

  if (unit !== 'auto') {
    const targetIndex = units.indexOf(unit)
    if (targetIndex === -1) return '0 B'
    const n = bytes / Math.pow(1024, targetIndex)
    return format
      ? `${formatNumber(n, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${unit}`
      : `${n.toFixed(decimals)} ${unit}`
  }

  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return format
    ? `${formatNumber(n, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${units[i]}`
    : `${n.toFixed(decimals)} ${units[i]}`
}

export function formatNumber(
  num: number,
  { locale = 'en-US', minimumFractionDigits, maximumFractionDigits }: FormatNumberOptions = {},
): string {
  if (!Number.isFinite(num)) return '0'
  return num.toLocaleString(locale, { minimumFractionDigits, maximumFractionDigits })
}

export function formatSpeed(bps?: number): string {
  if (!bps || bps <= 0) return '-'
  return `${formatBytes(bps)}/s`
}

export function formatEta(sec?: number | null): string {
  if (!sec && sec !== 0) return '-'
  const s = Math.max(0, sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = Math.floor(s % 60)
  if (h > 0) return `${h}h ${m}m ${r}s`
  if (m > 0) return `${m}m ${r}s`
  return `${r}s`
}
