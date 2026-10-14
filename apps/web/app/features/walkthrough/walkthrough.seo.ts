import { createFormatter, createTranslator } from 'use-intl/core'
import { gamePath, gameTitle, isExplicit, primaryCover, type GameHeader } from '~/features/game'
import { labelOf } from '~/shared/i18n/labels'
import { siteTimeZone } from '~/shared/i18n/site-time'
import { publicText } from '~/shared/richtext/rich-text'
import { clipped, shareImage, type HeadTexts, type PageHead } from '~/shared/seo/seo'
import { breadcrumbs } from '~/shared/seo/structured-data'
import { walkthroughPath, walkthroughsPath, type Guides } from './walkthrough'

export function walkthroughHead(
  { summaries, shown }: Guides,
  header: GameHeader,
  texts: HeadTexts,
): PageHead {
  const { locale, messages } = texts
  const t = createTranslator({ locale, messages, namespace: 'walkthrough.seo' })
  const format = createFormatter({ locale, timeZone: siteTimeZone })
  const game = gameTitle(header, locale)
  const titled = t('titled', { game })
  if (shown === undefined) {
    return { title: titled, indexable: false }
  }
  const author = shown.creator.name
  const routes = shown.routes ?? []
  const named = routes.map(route => route.name.trim()).filter(name => name !== '')
  const language =
    shown.lang === null ? undefined : labelOf(messages.walkthrough.language, shown.lang)
  const lead = t('lead', {
    author,
    game,
    count: routes.length,
    date: format.dateTime(new Date(shown.updated), { dateStyle: 'long' }),
  })
  const names = named.length === 0 ? '' : t('routes', { names: format.list(named.slice(0, 8)) })
  const note = shown.note === undefined ? '' : publicText(shown.note)
  const cover = primaryCover(header)
  const path = walkthroughPath(locale, header.id, shown.id)
  return {
    title: summaries.length > 1 ? t('by', { title: titled, author }) : titled,
    description: clipped(
      [lead, language === undefined ? '' : t('language', { language }), names, note].join(''),
    ),
    image: shareImage(`/walkthrough/${shown.id}`, titled),
    kind: 'article',
    structured: at => [
      {
        '@type': 'Article',
        headline: titled,
        author: { '@type': 'Person', name: author },
        datePublished: shown.created,
        dateModified: shown.updated,
        mainEntityOfPage: at(path),
        ...(cover === undefined || cover.masked || isExplicit(cover) ? {} : { image: cover.url }),
      },
      breadcrumbs(at, [
        { name: game, path: gamePath(locale, header.id) },
        { name: messages.walkthrough.label, path: walkthroughsPath(locale, header.id) },
      ]),
    ],
  }
}
