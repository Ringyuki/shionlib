import type { ReactElement } from 'react'
import { config, type Locale } from '@/config'
import { NotFoundError } from '@/services/backend'
import {
  fetchCharacter,
  fetchDeveloper,
  fetchGameHeader,
  fetchGameResources,
  fetchGames,
  fetchProfile,
  fetchResource,
  fetchTranslator,
  fetchWalkthrough,
  type GameHeader,
  type GameList,
} from '@/services/catalog'
import { loadPictures, type Picture } from '@/services/pictures'
import { CollectionCard, HomeCard } from '@/templates/collection'
import { HeroCard } from '@/templates/hero'
import { ProfileCard } from '@/templates/profile'
import {
  developerCollection,
  homeView,
  profileView,
  translatorCollection,
  type CollectionView,
} from './collection'
import {
  characterHero,
  docsHero,
  gameHero,
  resourceHero,
  walkthroughHero,
  type DocsInput,
  type HeroView,
} from './hero'

export type Card = { element: ReactElement; pictures: Picture[] }

const worksPage = { page: 1, pageSize: 10 }

async function drawn(
  urls: (string | undefined)[],
  draw: (loaded: Set<string>) => ReactElement,
): Promise<Card> {
  const pictures = await loadPictures(urls)
  return { element: draw(new Set(pictures.map(picture => picture.src))), pictures }
}

function hero(view: HeroView, locale: Locale): Promise<Card> {
  return drawn([view.picture?.src, view.byline?.avatar], loaded => (
    <HeroCard view={view} locale={locale} loaded={loaded} />
  ))
}

function collection(view: CollectionView, locale: Locale): Promise<Card> {
  return drawn([view.logo, ...view.shelf.map(cover => cover.src)], loaded => (
    <CollectionCard view={view} locale={locale} loaded={loaded} />
  ))
}

async function optionalGame(id: number | undefined): Promise<GameHeader | undefined> {
  if (id === undefined) {
    return undefined
  }
  try {
    return await fetchGameHeader(id)
  } catch (err) {
    if (err instanceof NotFoundError) {
      return undefined
    }
    throw err
  }
}

export async function gameCard(id: number, locale: Locale): Promise<Card> {
  const [game, resources] = await Promise.all([fetchGameHeader(id), fetchGameResources(id)])
  return hero(gameHero(game, resources, locale), locale)
}

export async function resourceCard(id: number, locale: Locale): Promise<Card> {
  return hero(resourceHero(await fetchResource(id), locale), locale)
}

export async function walkthroughCard(id: number, locale: Locale): Promise<Card> {
  const walkthrough = await fetchWalkthrough(id)
  const game = await fetchGameHeader(walkthrough.game_id)
  return hero(walkthroughHero(walkthrough, game, locale), locale)
}

export async function characterCard(id: number, locale: Locale): Promise<Card> {
  const character = await fetchCharacter(id)
  const game = await optionalGame(character.appearances[0]?.game_id)
  return hero(characterHero(character, game, locale), locale)
}

export async function developerCard(id: number, locale: Locale): Promise<Card> {
  const [developer, works] = await Promise.all([
    fetchDeveloper(id),
    fetchGames({ developer_id: id, ...worksPage }),
  ])
  return collection(developerCollection(developer, works, locale), locale)
}

export async function translatorCard(id: number, locale: Locale): Promise<Card> {
  const [translator, works] = await Promise.all([
    fetchTranslator(id),
    fetchGames({ translator_id: id, ...worksPage }),
  ])
  return collection(translatorCollection(translator, works, locale), locale)
}

export async function userCard(id: number, locale: Locale): Promise<Card> {
  const view = profileView(await fetchProfile(id), locale)
  return drawn([view.cover, view.avatar], loaded => (
    <ProfileCard view={view} locale={locale} loaded={loaded} />
  ))
}

export function docsCard(input: DocsInput, locale: Locale): Promise<Card> {
  return hero(docsHero(input, locale), locale)
}

const emptyList: GameList = { items: [], meta: { totalItems: 0 } }

export async function homeCard(locale: Locale): Promise<Card> {
  const hot = await fetchGames({ 'filter[sort_by]': 'views', page: 1, pageSize: 12 }).catch(
    () => emptyList,
  )
  const view = homeView(hot)
  return drawn(
    view.shelf.map(cover => cover.src),
    loaded => <HomeCard view={view} locale={locale} loaded={loaded} host={config.SITE_HOST} />,
  )
}
