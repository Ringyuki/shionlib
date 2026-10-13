import { constraints } from '~/shared/api/generated/constraints'
import type { ApiQuery, Schema } from '~/shared/api/types'
import type { Locale } from '~/shared/i18n/locale'
import { bbcodePlainText } from '~/shared/markup/bbcode'
import type { GameOrder } from './game-order'

type Titled = Pick<Schema<'GameHeaderDTO'>, 'title_zh' | 'title_jp' | 'title_en'>

type Covered = Pick<Schema<'GameHeaderDTO'>, 'covers'>

type Cover = Schema<'GameCoverDTO'>

type Credited = Pick<Schema<'GameListItemDTO'>, 'developers'>

type Dated = Pick<Schema<'GameListItemDTO'>, 'release_date'>

export type Platform = NonNullable<Schema<'DownloadSourceBodyInput'>['platform']>[number]

export type ResourceLanguage = NonNullable<Schema<'DownloadSourceBodyInput'>['language']>[number]

export const platforms: readonly Platform[] = constraints.DownloadSourceBodyInput.platform.itemEnum

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

type Rated = Pick<Cover, 'sexual' | 'violence'>

export function isExplicit(picture: Rated): boolean {
  return picture.sexual > 0 || picture.violence > 0
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

export type GameSummary = Schema<'GameCardDTO'>

export type GameDetails = Schema<'GameDetailsDTO'>

export type Works = { games: GameSummary[]; total: number; page: number; order: GameOrder }

export type WorksOf = { developer: number } | { character: number } | { translator: number }

export const worksPageSize = 36

export type GameImage = Pick<Cover, 'url' | 'dims' | 'sexual' | 'violence'>

export const gameTabs = ['resources', 'info', 'characters', 'comments', 'walkthrough'] as const

export type GameTab = (typeof gameTabs)[number]

export const introLanguages = ['zh', 'jp', 'en'] as const

export type IntroLanguage = (typeof introLanguages)[number]

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

export function tabAt(pathname: string, pathOf: (tab: GameTab) => string): GameTab {
  const within = (tab: GameTab) =>
    pathname === pathOf(tab) || pathname.startsWith(`${pathOf(tab)}/`)
  return gameTabs.find(tab => tab !== 'resources' && within(tab)) ?? 'resources'
}

export function tagPath(locale: Locale, tag: string): string {
  return `/${locale}/game?${new URLSearchParams({ tag })}`
}

export type GameSort = NonNullable<ApiQuery<'/game/list', 'get'>['filter[sort_by]']>

export function sortedGamesPath(locale: Locale, sort: GameSort): string {
  return `/${locale}/game?${new URLSearchParams({ sort })}`
}

export type ResourceRule = NonNullable<ApiQuery<'/game/list', 'get'>['resources']>

export const resourceRules = ['any', 'required'] as const satisfies readonly ResourceRule[]

export function requiresResources(rule: ResourceRule | undefined, byDefault: boolean): boolean {
  return rule === undefined ? byDefault : rule === 'required'
}

export function resourceRuleFor(required: boolean, byDefault: boolean): ResourceRule | undefined {
  if (required === byDefault) {
    return undefined
  }
  return required ? 'required' : 'any'
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
  const intro = bbcodePlainText(preferredIntro(game, locale)).replace(/\s+/g, ' ').trim()
  return intro.length <= descriptionLength ? intro : `${intro.slice(0, descriptionLength - 1)}…`
}

export function plainPictures<Picture extends Rated>(
  pictures: readonly Picture[],
  showsExplicit: boolean,
): Picture[] {
  return showsExplicit ? [...pictures] : pictures.filter(picture => !isExplicit(picture))
}

export function bannerIndex(images: readonly GameImage[]): number | undefined {
  const index = images.findIndex(image => !isExplicit(image))
  return index === -1 ? undefined : index
}
