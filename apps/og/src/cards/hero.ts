import type { Locale } from '@/config'
import { formatBytes, formatCalendarDay, formatSiteDay } from '@/i18n/format'
import { labelsOf } from '@/i18n/messages'
import { pictureUrl } from '@/services/pictures'
import type {
  Character,
  GameHeader,
  Resource,
  ResourceDetail,
  Walkthrough,
} from '@/services/catalog'
import { coverOf } from './covers'
import { characterName, gameTitle, joined, originalName, originalTitle } from './names'
import { languageTags, platformTags, softTags, type TagItem } from './tags'

export type HeroPicture = {
  src: string
  dims: number[]
  masked: boolean
  shape: 'cover' | 'portrait' | 'banner'
}

export type Fact = { icon: 'size' | 'downloads'; text: string }

export type HeroView = {
  badge?: { label: string; icon?: 'map' }
  title: string
  subtitle?: string
  description?: string
  meta?: string
  facts?: Fact[]
  tags: TagItem[]
  note?: string
  byline?: { name: string; avatar?: string; date?: string }
  picture?: HeroPicture
}

const listSeparators: Record<Locale, string> = { zh: '、', en: ', ', ja: '、' }

export function listOf(locale: Locale, values: string[]): string {
  return values.filter(value => value.trim() !== '').join(listSeparators[locale])
}

function coverPicture(game: Pick<GameHeader, 'covers'>): HeroPicture | undefined {
  const cover = coverOf(game.covers)
  return cover && { ...cover, shape: 'cover' }
}

export function gameHero(game: GameHeader, resources: Resource[], locale: Locale): HeroView {
  const labels = labelsOf(locale)
  return {
    title: gameTitle(game, locale),
    subtitle: originalTitle(game, locale),
    meta: joined([
      listOf(
        locale,
        game.developers.map(credit => credit.developer.name),
      ),
      game.release_date ? formatCalendarDay(locale, game.release_date) : undefined,
    ]),
    tags: [
      ...platformTags(
        resources.flatMap(resource => resource.platform),
        labels,
      ),
      ...languageTags(
        resources.flatMap(resource => resource.language),
        labels,
      ),
    ],
    note: resources.length > 0 ? labels.resources(resources.length) : undefined,
    picture: coverPicture(game),
  }
}

export function resourceHero({ game, resource }: ResourceDetail, locale: Locale): HeroView {
  const labels = labelsOf(locale)
  const size = resource.files.reduce((total, file) => total + file.file_size, 0)
  const facts: Fact[] = [
    ...(resource.files.length > 0
      ? [{ icon: 'size' as const, text: formatBytes(locale, size) }]
      : []),
    { icon: 'downloads', text: labels.downloads(resource.downloads) },
  ]
  return {
    title: gameTitle(game, locale),
    subtitle:
      listOf(
        locale,
        resource.translators.map(translator => translator.name),
      ) || undefined,
    facts,
    tags: [
      ...platformTags(resource.platform, labels),
      ...languageTags(resource.language, labels),
      ...softTags([resource.form ? labels.form[resource.form] : undefined]),
    ],
    picture: coverPicture(game),
  }
}

const shownRoutes = 3

export function walkthroughHero(
  walkthrough: Walkthrough,
  game: GameHeader,
  locale: Locale,
): HeroView {
  const labels = labelsOf(locale)
  const routes = walkthrough.routes.map(route => route.name.trim()).filter(name => name !== '')
  return {
    badge: { label: labels.walkthrough, icon: 'map' },
    title: gameTitle(game, locale),
    meta: joined([
      walkthrough.creator.name,
      walkthrough.lang ? labels.walkthroughLanguage[walkthrough.lang] : undefined,
      labels.updated(formatSiteDay(locale, walkthrough.updated)),
    ]),
    tags: softTags(routes.slice(0, shownRoutes)),
    note: routes.length > shownRoutes ? labels.moreRoutes(routes.length) : undefined,
    picture: coverPicture(game),
  }
}

export function characterHero(
  character: Character,
  game: GameHeader | undefined,
  locale: Locale,
): HeroView {
  const labels = labelsOf(locale)
  const appearance = character.appearances[0]
  const image = pictureUrl(character.image)
  const gender = character.gender[0]
  return {
    title: characterName(character, locale),
    subtitle: originalName(character, locale),
    meta: joined([
      game ? gameTitle(game, locale) : undefined,
      appearance?.actor ? labels.voice(appearance.actor) : undefined,
    ]),
    tags: softTags([
      appearance ? labels.role[appearance.role] : undefined,
      gender ? labels.gender[gender] : undefined,
      character.age ? labels.age(character.age) : undefined,
    ]),
    picture: image ? { src: image, dims: [], masked: false, shape: 'portrait' } : undefined,
  }
}

export type DocsInput = {
  title: string
  description?: string
  banner?: string
  category?: string
  authorName?: string
  authorAvatar?: string
  date?: string
}

export function docsHero(input: DocsInput, locale: Locale): HeroView {
  const labels = labelsOf(locale)
  const banner = pictureUrl(input.banner)
  const avatar = pictureUrl(input.authorAvatar)
  return {
    badge: {
      label: joined([
        labels.docs,
        input.category ? labels.docsCategory[input.category] : undefined,
      ]),
    },
    title: input.title,
    description: input.description,
    tags: [],
    byline: input.authorName
      ? {
          name: input.authorName,
          avatar,
          date: input.date ? formatSiteDay(locale, input.date) : undefined,
        }
      : undefined,
    picture: banner ? { src: banner, dims: [], masked: false, shape: 'banner' } : undefined,
  }
}
