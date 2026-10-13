import * as v from 'valibot'
import { orderFrom, platformFrom, resourceRuleFrom } from '~/features/game'
import { maxChosen, maxTagLength, months, type LibraryAddress } from './library'

const tag = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(maxTagLength))

const whole = v.pipe(v.string(), v.toNumber(), v.safeInteger())

const legacyPrefix = 'filter['

const legacyNames: Readonly<Record<string, string>> = {
  tags: 'tag',
  exclude_tags: 'exclude',
  platforms: 'platform',
  years: 'year',
  months: 'month',
  sort_by: 'sort',
  sort_order: 'order',
}

function chosen<Value>(raws: readonly string[], read: (raw: string) => Value | undefined): Value[] {
  const values = raws.map(read).filter(value => value !== undefined)
  return [...new Set(values)].slice(0, maxChosen)
}

function tagFrom(raw: string): string | undefined {
  const parsed = v.safeParse(tag, raw)
  return parsed.success ? parsed.output : undefined
}

function oneOf(allowed: readonly number[]): (raw: string) => number | undefined {
  return raw => {
    const parsed = v.safeParse(whole, raw)
    return parsed.success && allowed.includes(parsed.output) ? parsed.output : undefined
  }
}

export function addressFrom(
  params: URLSearchParams,
  page: number,
  years: readonly number[],
): LibraryAddress {
  const chosenYears = chosen(params.getAll('year'), oneOf(years))
  return {
    tags: chosen(params.getAll('tag'), tagFrom),
    excluded: chosen(params.getAll('exclude'), tagFrom),
    platforms: chosen(params.getAll('platform'), platformFrom),
    years: chosenYears,
    months: chosenYears.length === 0 ? [] : chosen(params.getAll('month'), oneOf(months)),
    ...orderFrom(params),
    resources: resourceRuleFrom(params.get('resources')),
    page,
  }
}

export function legacyParams(params: URLSearchParams): URLSearchParams | undefined {
  const keys = [...params.keys()]
  if (!keys.some(key => key.startsWith(legacyPrefix))) {
    return undefined
  }
  const renamed = new URLSearchParams()
  for (const [key, value] of params) {
    if (!key.startsWith(legacyPrefix)) {
      renamed.append(key, value)
      continue
    }
    const [field = ''] = key.slice(legacyPrefix.length).split(']')
    const name = Object.hasOwn(legacyNames, field) ? legacyNames[field] : undefined
    if (name !== undefined) {
      renamed.append(name, value)
    }
  }
  return renamed
}
