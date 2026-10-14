import type { Locale } from '@/config'
import { labelsOf } from '@/i18n/messages'
import { pictureUrl } from '@/services/pictures'
import type { Developer, GameList, Profile, Translator } from '@/services/catalog'
import { coverOf, type ShownCover } from './covers'
import { listOf } from './hero'
import { joined } from './names'

export type Shelf = { src: string; masked: boolean }

export type CollectionView = {
  name: string
  logo?: string
  subtitle: string
  shelf: Shelf[]
}

export type ProfileView = {
  name: string
  avatar?: string
  cover?: string
  bio?: string
  marks: { label: string; tone: 'accent' | 'neutral' }[]
  stats: { label: string; value: number }[]
}

export type HomeView = { shelf: Shelf[] }

export function shelfOf(games: GameList, size: number): Shelf[] {
  return games.items
    .map(game => coverOf(game.covers))
    .filter((cover): cover is ShownCover => cover !== undefined)
    .slice(0, size)
    .map(cover => ({ src: cover.src, masked: cover.masked }))
}

export const collectionShelf = 5
export const homeShelf = 6

export function developerCollection(
  developer: Developer,
  works: GameList,
  locale: Locale,
): CollectionView {
  return {
    name: developer.name,
    logo: pictureUrl(developer.logo),
    subtitle: joined([
      listOf(locale, developer.aliases),
      labelsOf(locale).works(works.meta.totalItems),
    ]),
    shelf: shelfOf(works, collectionShelf),
  }
}

export function translatorCollection(
  translator: Translator,
  works: GameList,
  locale: Locale,
): CollectionView {
  return {
    name: translator.name,
    subtitle: joined([
      listOf(locale, translator.aliases),
      labelsOf(locale).works(works.meta.totalItems),
    ]),
    shelf: shelfOf(works, collectionShelf),
  }
}

export function profileView(profile: Profile, locale: Locale): ProfileView {
  const labels = labelsOf(locale)
  return {
    name: profile.name,
    avatar: pictureUrl(profile.avatar),
    cover: pictureUrl(profile.cover),
    bio: profile.bio?.replace(/\s+/g, ' ').trim() || undefined,
    marks: [
      ...(profile.is_sponsor ? [{ label: labels.sponsor, tone: 'accent' as const }] : []),
      ...(profile.is_admin ? [{ label: labels.admin, tone: 'neutral' as const }] : []),
    ],
    stats: [
      { label: labels.uploads, value: profile.resource_count },
      { label: labels.comments, value: profile.comment_count },
      { label: labels.walkthroughs, value: profile.walkthrough_count },
    ],
  }
}

export function homeView(games: GameList): HomeView {
  return { shelf: shelfOf(games, homeShelf) }
}
