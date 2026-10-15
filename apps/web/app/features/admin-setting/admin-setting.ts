export const kinds = ['int', 'bytes', 'float', 'duration', 'flag', 'text', 'secret'] as const

export type Kind = (typeof kinds)[number]

export type Value = number | boolean | string

export const hiddenValue = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'

export type LastChange = {
  editor: string | undefined
  at: string
}

export type Setting = {
  name: string
  group: string
  label: string
  description: string
  kind: Kind
  value: Value
  fallback: Value
  min: number | undefined
  max: number | undefined
  maxLength: number | undefined
  overridden: boolean
  lastChange: LastChange | undefined
}

export type Change = {
  id: number
  editor: string | undefined
  at: string
  previous: Value | undefined
  value: Value | undefined
}

export const sections = [
  { key: 'account', groups: ['user', 'sponsor'] },
  { key: 'upload', groups: ['upload'] },
  { key: 'download', groups: ['download'] },
  { key: 'ad', groups: ['ad'] },
  { key: 'scan', groups: ['scan'] },
  { key: 'composition', groups: ['composition'] },
  { key: 'throttle', groups: ['throttle'] },
  { key: 'hot_score', groups: ['hot_score'] },
  { key: 'catalog', groups: ['catalog'] },
  { key: 'search', groups: ['search'] },
  { key: 'ai', groups: ['ai'] },
  { key: 'open', groups: ['open'] },
  { key: 'indexing', groups: ['indexing'] },
  { key: 'credentials', groups: ['oidc', 'bangumi', 'payment'] },
] as const

export type SectionKey = (typeof sections)[number]['key'] | 'other'

export type Section = {
  key: SectionKey
  settings: Setting[]
}

export function sectioned(settings: readonly Setting[]): Section[] {
  const known: readonly string[] = sections.flatMap(section => section.groups)
  const named: Section[] = sections.map(section => {
    const groups: readonly string[] = section.groups
    return {
      key: section.key,
      settings: settings.filter(setting => groups.includes(setting.group)),
    }
  })
  const rest: Section = {
    key: 'other',
    settings: settings.filter(setting => !known.includes(setting.group)),
  }
  return [...named, rest].filter(section => section.settings.length > 0)
}

export function matching(settings: readonly Setting[], query: string): Setting[] {
  const wanted = query.trim().toLowerCase()
  if (wanted === '') {
    return [...settings]
  }
  return settings.filter(setting =>
    [setting.label, setting.description, setting.name].some(text =>
      text.toLowerCase().includes(wanted),
    ),
  )
}

export type UnitName = 'B' | 'KiB' | 'MiB' | 'GiB' | 'TiB' | 'second' | 'minute' | 'hour' | 'day'

export type Unit = {
  unit: UnitName
  size: number
}

const kibi = 1024

export const byteUnits: readonly Unit[] = [
  { unit: 'B', size: 1 },
  { unit: 'KiB', size: kibi },
  { unit: 'MiB', size: kibi ** 2 },
  { unit: 'GiB', size: kibi ** 3 },
  { unit: 'TiB', size: kibi ** 4 },
]

export const durationUnits: readonly Unit[] = [
  { unit: 'second', size: 1 },
  { unit: 'minute', size: 60 },
  { unit: 'hour', size: 60 * 60 },
  { unit: 'day', size: 24 * 60 * 60 },
]

export function unitsOf(kind: Kind): readonly Unit[] | undefined {
  if (kind === 'bytes') {
    return byteUnits
  }
  return kind === 'duration' ? durationUnits : undefined
}

export function fittingUnit(units: readonly Unit[], value: number): Unit {
  const whole = units.filter(unit => value !== 0 && value % unit.size === 0)
  return whole.at(-1) ?? units[0] ?? { unit: 'B', size: 1 }
}

export type Draft = Readonly<Record<string, Value>>

export function shownValue(setting: Setting, draft: Draft): Value {
  return draft[setting.name] ?? setting.value
}

export function edited(settings: readonly Setting[], draft: Draft): Setting[] {
  return settings.filter(setting => shownValue(setting, draft) !== setting.value)
}

export function drafted(draft: Draft, setting: Setting, value: Value): Draft {
  const rest = Object.fromEntries(Object.entries(draft).filter(([name]) => name !== setting.name))
  return value === setting.value ? rest : { ...rest, [setting.name]: value }
}

export type Problem =
  | { kind: 'number' }
  | { kind: 'whole' }
  | { kind: 'min'; bound: number }
  | { kind: 'max'; bound: number }
  | { kind: 'length'; bound: number }

export function problemOf(setting: Setting, value: Value): Problem | undefined {
  if (typeof value === 'string') {
    return setting.maxLength !== undefined && [...value].length > setting.maxLength
      ? { kind: 'length', bound: setting.maxLength }
      : undefined
  }
  if (typeof value === 'boolean') {
    return undefined
  }
  if (!Number.isFinite(value)) {
    return { kind: 'number' }
  }
  if (setting.kind !== 'float' && !Number.isInteger(value)) {
    return { kind: 'whole' }
  }
  if (setting.min !== undefined && value < setting.min) {
    return { kind: 'min', bound: setting.min }
  }
  if (setting.max !== undefined && value > setting.max) {
    return { kind: 'max', bound: setting.max }
  }
  return undefined
}

export type Saved = {
  name: string
  value: Value
  restore: boolean
}

export function savesOf(settings: readonly Setting[], draft: Draft): Saved[] {
  return edited(settings, draft).map(setting => {
    const value = shownValue(setting, draft)
    return { name: setting.name, value, restore: value === setting.fallback }
  })
}

export const historyShown = 50
