import { createFormatter, createTranslator } from 'use-intl/core'
import { gamePath, gameTitle } from '~/features/game'
import { byteSize } from '~/shared/i18n/bytes'
import { labelOf } from '~/shared/i18n/labels'
import { siteTimeZone } from '~/shared/i18n/site-time'
import { publicText } from '~/shared/richtext/rich-text'
import { clipped, shareImage, type HeadTexts, type PageHead } from '~/shared/seo/seo'
import { breadcrumbs } from '~/shared/seo/structured-data'
import type { ResourcePage, ResourceTab } from './resource-page'
import { fileState } from './resource'

function sizeOf(bytes: number, { locale }: HeadTexts): string {
  const size = byteSize(bytes)
  const format = createFormatter({ locale, timeZone: siteTimeZone })
  return `${format.number(size.value, { maximumFractionDigits: size.unit === 'B' ? 0 : 2 })} ${size.unit}`
}

export function resourceHeadTitle({ resource, game }: ResourcePage, texts: HeadTexts): string {
  const { locale, messages } = texts
  const t = createTranslator({ locale, messages, namespace: 'resource.seo' })
  const words = [
    gameTitle(game, locale),
    ...(resource.platform ?? []).map(key => labelOf(messages.game.platform, key)),
    ...(resource.language ?? []).map(key => labelOf(messages.game.language, key)),
  ]
  const downloadable = (resource.files ?? []).some(file => fileState(file) === 'passed')
  return downloadable ? t('download', { words: words.join(' ') }) : words.join(' ')
}

function descriptionOf({ resource, game }: ResourcePage, texts: HeadTexts): string {
  const { locale, messages } = texts
  const t = createTranslator({ locale, messages, namespace: 'resource.seo' })
  const format = createFormatter({ locale, timeZone: siteTimeZone })
  const files = resource.files ?? []
  const facts = [
    t('lead', {
      title: gameTitle(game, locale),
      platforms: format.list(
        (resource.platform ?? []).map(key => labelOf(messages.game.platform, key)),
      ),
      languages: format.list(
        (resource.language ?? []).map(key => labelOf(messages.game.language, key)),
      ),
    }),
    (resource.translators ?? []).length === 0
      ? ''
      : t('translators', {
          names: format.list((resource.translators ?? []).map(credit => credit.name)),
        }),
    resource.form === null ? '' : t('form', { form: messages.resource.formName[resource.form] }),
    files.length === 0
      ? ''
      : t('files', {
          count: files.length,
          size: sizeOf(
            files.reduce((total, file) => total + file.file_size, 0),
            texts,
          ),
        }),
  ]
  const note = resource.note ? publicText(resource.note) : ''
  return clipped([...facts, note].join(''))
}

export function resourceHead(
  page: ResourcePage,
  texts: HeadTexts,
  tab: ResourceTab = 'contents',
): PageHead {
  const { resource, game } = page
  const { locale, messages } = texts
  const title = resourceHeadTitle(page, texts)
  return {
    title: tab === 'contents' ? title : `${title} ${messages.resource.page.tabs[tab]}`,
    description: descriptionOf(page, texts),
    image: shareImage(`/resource/${resource.id}`, gameTitle(game, locale)),
    indexable: tab === 'contents',
    structured: at => [
      breadcrumbs(at, [
        { name: messages.library.title, path: `/${locale}/game` },
        { name: gameTitle(game, locale), path: gamePath(locale, game.id) },
        { name: title, path: `/${locale}/resource/${resource.id}` },
      ]),
    ],
  }
}
