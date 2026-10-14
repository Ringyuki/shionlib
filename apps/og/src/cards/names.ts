import type { Locale } from '@/config'
import type { Character, Titled } from '@/services/catalog'

const titleOrder: Record<Locale, (keyof Titled)[]> = {
  zh: ['title_zh', 'title_jp', 'title_en'],
  en: ['title_en', 'title_jp', 'title_zh'],
  ja: ['title_jp', 'title_zh', 'title_en'],
}

export function gameTitle(game: Titled, locale: Locale): string {
  return (
    titleOrder[locale].map(key => game[key].trim()).find(title => title !== '') ??
    game.title_jp.trim()
  )
}

export function originalTitle(game: Titled, locale: Locale): string | undefined {
  const original = game.title_jp.trim()
  return original !== '' && original !== gameTitle(game, locale) ? original : undefined
}

type Named = Pick<Character, 'name_jp' | 'name_zh' | 'name_en'>

export function characterName(character: Named, locale: Locale): string {
  const localized = locale === 'zh' ? character.name_zh : locale === 'en' ? character.name_en : ''
  return localized.trim() || character.name_jp.trim()
}

export function originalName(character: Named, locale: Locale): string | undefined {
  const original = character.name_jp.trim()
  return original !== '' && original !== characterName(character, locale) ? original : undefined
}

export function joined(parts: (string | undefined)[], separator = ' · '): string {
  return parts.filter((part): part is string => part !== undefined && part !== '').join(separator)
}
