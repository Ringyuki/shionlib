import type { Schema } from '~/shared/api/types'
import type { Locale } from '~/shared/i18n/locale'

type Titled = Pick<Schema<'GameHeaderDTO'>, 'title_zh' | 'title_jp' | 'title_en'>

type Covered = Pick<Schema<'GameHeaderDTO'>, 'covers'>

type Cover = Schema<'GameCoverDTO'>

type Credited = Pick<Schema<'GameListItemDTO'>, 'developers'>

type Dated = Pick<Schema<'GameListItemDTO'>, 'release_date'>

export type Platform = NonNullable<Schema<'DownloadSourceBodyInput'>['platform']>[number]

export type ResourceLanguage = NonNullable<Schema<'DownloadSourceBodyInput'>['language']>[number]

const titleOrder: Record<Locale, (keyof Titled)[]> = {
  zh: ['title_zh', 'title_jp', 'title_en'],
  en: ['title_en', 'title_jp', 'title_zh'],
  ja: ['title_jp', 'title_zh', 'title_en'],
}

export function gameTitle(game: Titled, locale: Locale): string {
  return titleOrder[locale].map(key => game[key].trim()).find(title => title !== '') ?? ''
}

export function primaryCover(game: Covered): Cover | undefined {
  const covers = game.covers ?? []
  return covers.find(cover => cover.type === 'pkgfront') ?? covers[0]
}

export function isExplicit(cover: Pick<Cover, 'sexual' | 'violence'>): boolean {
  return cover.sexual > 0 || cover.violence > 0
}

export function originalTitle(game: Titled, locale: Locale): string | undefined {
  const original = game.title_jp.trim()
  return original !== '' && original !== gameTitle(game, locale) ? original : undefined
}

export function developerNames(game: Credited): string[] {
  return (game.developers ?? []).map(credit => credit.developer.name)
}

export function releaseDate(game: Dated): Date | undefined {
  return game.release_date === null ? undefined : new Date(game.release_date)
}

export type GameHeader = Schema<'GameHeaderDTO'>

export type GameDetails = Schema<'GameDetailsDTO'>

export type CharacterCredit = Schema<'GameCharacterCreditDTO'>

export type CharacterRole = CharacterCredit['role']

export type GameImage = Pick<Cover, 'url' | 'dims' | 'sexual' | 'violence'>

export const gameTabs = ['resources', 'info', 'characters'] as const

export type GameTab = (typeof gameTabs)[number]

export const characterRoles: readonly CharacterRole[] = ['main', 'primary', 'side', 'appears']

export const introLanguages = ['zh', 'jp', 'en'] as const

export type IntroLanguage = (typeof introLanguages)[number]

export const contentLimitShowSpoiler = 2

type Introduced = Pick<GameDetails, 'intro_zh' | 'intro_jp' | 'intro_en'>

const introKey = { zh: 'intro_zh', jp: 'intro_jp', en: 'intro_en' } as const

const introOrder: Record<Locale, IntroLanguage[]> = {
  zh: ['zh', 'jp', 'en'],
  en: ['en', 'jp', 'zh'],
  ja: ['jp', 'zh', 'en'],
}

export function gamePath(locale: Locale, id: number, tab: GameTab = 'resources'): string {
  const base = `/${locale}/game/${id}`
  return tab === 'resources' ? base : `${base}/${tab}`
}

export function introIn(game: Introduced, language: IntroLanguage): string {
  return game[introKey[language]].trim()
}

export function writtenIntros(game: Introduced, locale: Locale): IntroLanguage[] {
  return introOrder[locale].filter(language => introIn(game, language) !== '')
}

export function preferredIntro(game: Introduced, locale: Locale): string {
  const [first] = writtenIntros(game, locale)
  return first === undefined ? '' : introIn(game, first)
}

export function masked(image: Pick<Cover, 'sexual' | 'violence'>, contentLimit: number): boolean {
  return contentLimit === contentLimitShowSpoiler && isExplicit(image)
}

export function groupCharacters(
  credits: readonly CharacterCredit[],
): { role: CharacterRole; credits: CharacterCredit[] }[] {
  return characterRoles
    .map(role => ({ role, credits: credits.filter(credit => credit.role === role) }))
    .filter(group => group.credits.length > 0)
}

export function groupStaff(
  staffs: readonly Schema<'GameStaffDTO'>[],
): { role: string; names: string[] }[] {
  const groups = new Map<string, string[]>()
  for (const staff of staffs) {
    const names = groups.get(staff.role) ?? []
    if (!names.includes(staff.name)) {
      names.push(staff.name)
    }
    groups.set(staff.role, names)
  }
  return [...groups].map(([role, names]) => ({ role, names }))
}

export type Score = {
  value: number
  votes: number
  url: string
}

export type Scores = {
  bangumi?: Score
  vndb?: Score
}

export function bangumiScore(data: Schema<'BangumiScoreDTO'>, subject: string): Score | undefined {
  const { score, total } = data.rating
  return score > 0 && total > 0
    ? { value: score, votes: total, url: `https://bgm.tv/subject/${subject}` }
    : undefined
}

export function vndbScore(data: Schema<'VndbScoreDTO'>, vn: string): Score | undefined {
  return data.rating === null || data.votecount === 0
    ? undefined
    : { value: data.rating / 10, votes: data.votecount, url: `https://vndb.org/${vn}` }
}

export function imageSize(image: GameImage): { width: number; height: number } | undefined {
  const [width, height] = image.dims ?? []
  return width !== undefined && height !== undefined && width > 0 && height > 0
    ? { width, height }
    : undefined
}

const coverRatios = { fallback: 3 / 4, narrowest: 2 / 3, widest: 4 / 3 }

export function coverRatio(cover: GameImage | undefined): number {
  const size = cover === undefined ? undefined : imageSize(cover)
  if (size === undefined) {
    return coverRatios.fallback
  }
  return Math.min(coverRatios.widest, Math.max(coverRatios.narrowest, size.width / size.height))
}

const descriptionLength = 160

export function gameDescription(game: Introduced, locale: Locale): string {
  const intro = preferredIntro(game, locale).replace(/\s+/g, ' ').trim()
  return intro.length <= descriptionLength ? intro : `${intro.slice(0, descriptionLength - 1)}…`
}
