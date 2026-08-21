export const releasePeriods = (
  opts: { years?: number[]; months?: number[] } = {},
): string[] | undefined => {
  const years = uniqSorted((opts.years ?? []).filter(isFiniteNumber))
  const months = uniqSorted((opts.months ?? []).filter(isValidMonth))

  if (years.length === 0 && months.length === 0) return undefined

  if (years.length && months.length)
    return years.flatMap(year => months.map(month => period(year, month)))
  if (years.length) return years.map(year => String(year))

  const currentYear = new Date().getUTCFullYear()

  return months.map(month => period(currentYear, month))
}

const period = (year: number, month1to12: number): string => {
  return `${year}-${String(month1to12).padStart(2, '0')}`
}

const isFiniteNumber = (n: unknown): n is number => {
  return typeof n === 'number' && Number.isFinite(n)
}

const isValidMonth = (n: unknown): n is number => {
  return isFiniteNumber(n) && n >= 1 && n <= 12
}

const uniqSorted = (arr: number[]): number[] => {
  return Array.from(new Set(arr)).sort((a, b) => a - b)
}
