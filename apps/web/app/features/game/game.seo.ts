import { createFormatter, createTranslator } from 'use-intl/core'
import type { Schema } from '~/shared/api/types'
import { labelOf } from '~/shared/i18n/labels'
import { siteTimeZone } from '~/shared/i18n/site-time'
import {
  clipped,
  shareImage,
  type HeadTexts,
  type PageHead,
  type StructuredData,
} from '~/shared/seo/seo'
import { breadcrumbs } from '~/shared/seo/structured-data'
import { bbcodePlainText } from '~/shared/markup/bbcode'
import {
  developerNames,
  gamePath,
  gameTitle,
  isExplicit,
  originalTitle,
  preferredIntro,
  primaryCover,
  releaseDate,
  type GameDetails,
  type GameHeader,
  type GameTab,
} from './game'

type Offered = Pick<Schema<'DownloadResourceDTO'>, 'platform' | 'language'>

export type GameHeadData = {
  header: GameHeader
  details: GameDetails
  resources: readonly Offered[]
}

function distinct(values: readonly string[]): string[] {
  return [...new Set(values)]
}

export function gameHeadTitle(header: GameHeader, { locale, messages }: HeadTexts): string {
  const t = createTranslator({ locale, messages, namespace: 'game.seo' })
  const title = gameTitle(header, locale)
  const original = originalTitle(header, locale)
  return original === undefined ? title : t('titled', { title, original })
}

function leadOf({ header }: GameHeadData, { locale, messages }: HeadTexts): string {
  const t = createTranslator({ locale, messages, namespace: 'game.seo' })
  const format = createFormatter({ locale, timeZone: siteTimeZone })
  const title = gameTitle(header, locale)
  const developers = format.list(developerNames(header))
  const released = releaseDate(header)
  const date = released === undefined ? '' : format.dateTime(released, { dateStyle: 'long' })
  if (developers !== '' && date !== '') {
    return t('madeOn', { title, developers, date })
  }
  if (developers !== '') {
    return t('made', { title, developers })
  }
  return date === '' ? '' : t('released', { title, date })
}

function offerOf(resources: readonly Offered[], { locale, messages }: HeadTexts): string {
  if (resources.length === 0) {
    return ''
  }
  const t = createTranslator({ locale, messages, namespace: 'game.seo' })
  const format = createFormatter({ locale, timeZone: siteTimeZone })
  const platforms = distinct(resources.flatMap(resource => resource.platform ?? []))
  const languages = distinct(resources.flatMap(resource => resource.language ?? []))
  return t('resources', {
    count: resources.length,
    platforms: format.list(platforms.map(key => labelOf(messages.game.platform, key))),
    languages: format.list(languages.map(key => labelOf(messages.game.language, key))),
  })
}

export function gameHeadDescription(data: GameHeadData, texts: HeadTexts): string {
  const intro = bbcodePlainText(preferredIntro(data.details, texts.locale))
  return clipped([leadOf(data, texts), offerOf(data.resources, texts), intro].join(''))
}

function videoGame(
  data: GameHeadData,
  texts: HeadTexts,
  at: (path: string) => string,
): StructuredData {
  const { header } = data
  const { locale, messages } = texts
  const cover = primaryCover(header)
  const released = releaseDate(header)
  const original = originalTitle(header, locale)
  return {
    '@type': 'VideoGame',
    name: gameTitle(header, locale),
    alternateName: distinct([
      ...(original === undefined ? [] : [original]),
      ...(header.aliases ?? []),
    ]),
    url: at(gamePath(locale, header.id)),
    description: gameHeadDescription(data, texts),
    gamePlatform: (header.platform ?? []).map(key => labelOf(messages.game.platform, key)),
    author: developerNames(header).map(name => ({ '@type': 'Organization', name })),
    ...(released === undefined ? {} : { datePublished: released.toISOString().slice(0, 10) }),
    ...(cover === undefined || cover.masked || isExplicit(cover) ? {} : { image: cover.url }),
  }
}

export function gameHead(
  data: GameHeadData,
  texts: HeadTexts,
  tab: GameTab = 'resources',
): PageHead {
  const { header } = data
  const { locale, messages } = texts
  const title = gameHeadTitle(header, texts)
  const named =
    tab === 'resources' ? title : `${gameTitle(header, locale)} ${messages.game.tabs[tab]}`
  return {
    title: named,
    description: gameHeadDescription(data, texts),
    image: shareImage(`/game/${header.id}`, gameTitle(header, locale)),
    structured: at => [
      ...(tab === 'resources' ? [videoGame(data, texts, at)] : []),
      breadcrumbs(at, [
        { name: messages.library.title, path: `/${locale}/game` },
        { name: gameTitle(header, locale), path: gamePath(locale, header.id) },
      ]),
    ],
  }
}
