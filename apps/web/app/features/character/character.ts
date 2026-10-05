import type { Schema } from '~/shared/api/types'
import type { Locale } from '~/shared/i18n/locale'

type NameKey = 'name_jp' | 'name_zh' | 'name_en'

type Named = Pick<Schema<'GameCharacterDTO'>, NameKey> | Pick<Schema<'SearchCharacterDTO'>, NameKey>

export function characterName(character: Named, locale: Locale): string {
  const localized = locale === 'zh' ? character.name_zh : locale === 'en' ? character.name_en : null
  return localized?.trim() || character.name_jp
}
