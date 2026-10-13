import type { Works } from '~/features/game'
import type { Schema } from '~/shared/api/types'
import type { Locale } from '~/shared/i18n/locale'

type NameKey = 'name_jp' | 'name_zh' | 'name_en'

type Named = Pick<Schema<'GameCharacterDTO'>, NameKey> | Pick<Schema<'SearchCharacterDTO'>, NameKey>

export type CharacterDetail = Schema<'CharacterDetailDTO'>

export type CharacterContent = { character: CharacterDetail; works: Works }

export type Appearance = NonNullable<CharacterDetail['appearances']>[number]

export type CastCredit = Schema<'GameCharacterCreditDTO'>

export type CastRole = CastCredit['role']

export const castRoles: readonly CastRole[] = ['main', 'primary', 'side', 'appears']

const leapYear = 2000

export function characterPath(locale: Locale, id: number): string {
  return `/${locale}/character/${id}`
}

export function characterName(character: Named, locale: Locale): string {
  const localized = locale === 'zh' ? character.name_zh : locale === 'en' ? character.name_en : null
  return localized?.trim() || character.name_jp
}

export function otherNames(character: Pick<CharacterDetail, NameKey>, locale: Locale): string[] {
  const shown = characterName(character, locale)
  const names = [character.name_jp, character.name_zh, character.name_en]
    .map(name => name.trim())
    .filter(name => name !== '' && name !== shown)
  return [...new Set(names)]
}

export function groupCast(
  credits: readonly CastCredit[],
): { role: CastRole; credits: CastCredit[] }[] {
  return castRoles
    .map(role => ({ role, credits: credits.filter(credit => credit.role === role) }))
    .filter(group => group.credits.length > 0)
}

export function appearanceIn(
  character: Pick<CharacterDetail, 'appearances'>,
  gameId: number,
): Appearance | undefined {
  return (character.appearances ?? []).find(appearance => appearance.game_id === gameId)
}

export function voiceOf(credit: Pick<Appearance, 'actor'>): string | undefined {
  return credit.actor?.trim() || undefined
}

export function gendersOf(character: Pick<CharacterDetail, 'gender'>): string[] {
  return [...new Set((character.gender ?? []).filter(gender => gender !== ''))]
}

export function birthdayOf(character: Pick<CharacterDetail, 'birthday'>): Date | undefined {
  const [month, day] = character.birthday ?? []
  if (month === undefined || day === undefined) {
    return undefined
  }
  const birthday = new Date(Date.UTC(leapYear, month - 1, day))
  return birthday.getUTCMonth() === month - 1 && birthday.getUTCDate() === day
    ? birthday
    : undefined
}

export function measurementsOf(
  character: Pick<CharacterDetail, 'bust' | 'waist' | 'hips'>,
): { part: 'B' | 'W' | 'H'; size: number }[] {
  const sizes = [
    { part: 'B', size: character.bust },
    { part: 'W', size: character.waist },
    { part: 'H', size: character.hips },
  ] as const
  return sizes.flatMap(({ part, size }) => (size === null ? [] : [{ part, size }]))
}
