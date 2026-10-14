import { createFormatter, createTranslator } from 'use-intl/core'
import { gameTitle } from '~/features/game'
import { siteTimeZone } from '~/shared/i18n/site-time'
import { clipped, shareImage, type HeadTexts, type PageHead } from '~/shared/seo/seo'
import { breadcrumbs } from '~/shared/seo/structured-data'
import { translatorPath, translatorsPath, type TranslatorContent } from './translator'

export function translatorHead(
  { translator, works }: TranslatorContent,
  texts: HeadTexts,
): PageHead {
  const { locale, messages } = texts
  const t = createTranslator({ locale, messages, namespace: 'translator.seo' })
  const format = createFormatter({ locale, timeZone: siteTimeZone })
  const known = format.list(works.games.slice(0, 3).map(game => gameTitle(game, locale)))
  return {
    title: translator.name,
    description:
      works.total === 0
        ? undefined
        : clipped(t('lead', { name: translator.name, count: works.total, known })),
    image: shareImage(`/translator/${translator.id}`, translator.name),
    structured: at => [
      breadcrumbs(at, [
        { name: messages.translator.title, path: translatorsPath(locale) },
        { name: translator.name, path: translatorPath(locale, translator.id) },
      ]),
    ],
  }
}
