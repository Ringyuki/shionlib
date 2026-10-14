import { createFormatter, createTranslator } from 'use-intl/core'
import { gameTitle } from '~/features/game'
import { siteTimeZone } from '~/shared/i18n/site-time'
import { bbcodePlainText } from '~/shared/markup/bbcode'
import { clipped, shareImage, type HeadTexts, type PageHead } from '~/shared/seo/seo'
import { breadcrumbs } from '~/shared/seo/structured-data'
import { developerPath, developersPath, type DeveloperContent } from './developer'

const introOrder = {
  zh: ['intro_zh', 'intro_jp', 'intro_en'],
  en: ['intro_en', 'intro_jp', 'intro_zh'],
  ja: ['intro_jp', 'intro_zh', 'intro_en'],
} as const

export function developerHead({ developer, works }: DeveloperContent, texts: HeadTexts): PageHead {
  const { locale, messages } = texts
  const t = createTranslator({ locale, messages, namespace: 'developer.seo' })
  const format = createFormatter({ locale, timeZone: siteTimeZone })
  const known = format.list(works.games.slice(0, 3).map(game => gameTitle(game, locale)))
  const aliases = format.list(developer.aliases ?? [])
  const lead =
    works.total === 0
      ? ''
      : aliases === ''
        ? t('lead', { name: developer.name, count: works.total, known })
        : t('aliased', { name: developer.name, aliases, count: works.total, known })
  const intro = introOrder[locale].map(key => developer[key].trim()).find(text => text !== '') ?? ''
  return {
    title: developer.name,
    description: clipped(lead + bbcodePlainText(intro)),
    image: shareImage(`/developer/${developer.id}`, developer.name),
    structured: at => [
      breadcrumbs(at, [
        { name: messages.developer.title, path: developersPath(locale) },
        { name: developer.name, path: developerPath(locale, developer.id) },
      ]),
    ],
  }
}
