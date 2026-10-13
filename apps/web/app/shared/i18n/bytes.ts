const byteUnits = ['B', 'KB', 'MB', 'GB', 'TB'] as const

export type ByteSize = { value: number; unit: (typeof byteUnits)[number] }

export function byteSize(bytes: number): ByteSize {
  let value = Math.max(0, bytes)
  let unit = 0
  while (value >= 1024 && unit < byteUnits.length - 1) {
    value /= 1024
    unit += 1
  }
  return { value, unit: byteUnits[unit] ?? 'B' }
}

export function shortFractionDigits(value: number): number {
  if (value >= 100) {
    return 0
  }
  return value >= 10 ? 1 : 2
}
