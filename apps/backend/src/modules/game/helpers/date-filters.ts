import { Prisma } from '@prisma/client'

export const applyDate = (
  where: Prisma.GameWhereInput = {},
  opts: { years?: number[]; months?: number[] } = {},
): Prisma.GameWhereInput => {
  const years = uniqSorted((opts.years ?? []).filter(isFiniteNumber))
  const months = uniqSorted((opts.months ?? []).filter(isValidMonth))

  if (years.length === 0 && months.length === 0) return { ...where }

  const or: Prisma.GameWhereInput[] = []

  if (years.length && months.length) {
    for (const y of years) {
      for (const m of months) {
        or.push(monthClause(y, m))
      }
    }
  } else if (years.length) {
    for (const y of years) {
      or.push(yearClause(y))
    }
  } else if (months.length) {
    const y = new Date().getUTCFullYear()
    for (const m of months) {
      or.push(monthClause(y, m))
    }
  }

  return {
    AND: [{ ...where }, { OR: or }],
  }
}

const monthClause = (year: number, month1to12: number): Prisma.GameWhereInput => {
  const start = new Date(Date.UTC(year, month1to12 - 1, 1, 0, 0, 0, 0))
  const endEx = new Date(Date.UTC(year, month1to12, 1, 0, 0, 0, 0)) // first day of next month
  return { release_date: { gte: start, lt: endEx } }
}

const yearClause = (year: number): Prisma.GameWhereInput => {
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0))
  const endEx = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0)) // first day of next year
  return { release_date: { gte: start, lt: endEx } }
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
