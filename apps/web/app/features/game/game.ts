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

export function isExplicit(cover: Cover): boolean {
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
