import type { Works } from '~/features/game'
import { constraints } from '~/shared/api/generated/constraints'
import type { Schema } from '~/shared/api/types'
import type { Locale } from '~/shared/i18n/locale'

export type TranslatorItem = Schema<'TranslatorListItemDTO'>

export type TranslatorDetail = Schema<'TranslatorDetailDTO'>

export type Translators = { query: string; page: number; items: TranslatorItem[]; total: number }

export type TranslatorContent = { translator: TranslatorDetail; works: Works }

export type TranslatorChoice = { value: string; label: string; works: number; fresh: boolean }

export const pageSize = 48

export const maxQueryLength = 100

export const suggestDelay = 250

export const maxNameLength = constraints.AdminTranslatorEditInputBody.name.maxLength

export function translatorsPath(locale: Locale, query = ''): string {
  const base = `/${locale}/translator`
  return query === '' ? base : `${base}?${new URLSearchParams({ q: query })}`
}

export function translatorPath(locale: Locale, id: number): string {
  return `/${locale}/translator/${id}`
}

export function normalizedQuery(raw: string | null): string {
  return [...(raw ?? '').trim()].slice(0, maxQueryLength).join('')
}

export function homepageOf(translator: Pick<TranslatorDetail, 'homepage'>): string | undefined {
  const homepage = (translator.homepage ?? '').trim()
  return homepage === '' ? undefined : homepage
}

export function cleanName(typed: string): string {
  return typed.normalize('NFC').split(/\s+/u).filter(Boolean).join(' ')
}

export function nameKey(name: string): string {
  return cleanName(name.normalize('NFKC')).toLowerCase()
}

export function chosenChoice(name: string): TranslatorChoice {
  return { value: name, label: name, works: 0, fresh: false }
}

export function translatorChoices(
  found: readonly TranslatorItem[],
  typed: string,
  chosen: readonly string[],
): TranslatorChoice[] {
  const name = cleanName(typed)
  const key = nameKey(name)
  const taken = new Set(chosen.map(nameKey))
  const known = found.map(item => ({
    value: chosen.find(picked => nameKey(picked) === nameKey(item.name)) ?? item.name,
    label: item.name,
    works: item.works_count,
    fresh: false,
  }))
  const named = found.some(item =>
    [item.name, ...(item.aliases ?? [])].some(n => nameKey(n) === key),
  )
  const creatable = name !== '' && [...name].length <= maxNameLength && !named && !taken.has(key)
  return creatable ? [...known, { value: name, label: name, works: 0, fresh: true }] : known
}
