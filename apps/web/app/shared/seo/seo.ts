import type { MetaDescriptor } from 'react-router'
import type { Messages } from 'use-intl/core'
import { defaultLocale, type Locale } from '~/shared/i18n/locale'
import { isLocale } from '~/shared/i18n/locale.schema'
import { siteFrom, type Site } from './seo.schema'

export type StructuredData = { readonly '@type': string } & Readonly<Record<string, unknown>>

export type ShareImage = { path: string; query?: Readonly<Record<string, string>>; alt: string }

export type PageHead = {
  title: string
  whole?: boolean
  description?: string
  image?: ShareImage
  kind?: 'website' | 'article' | 'profile'
  indexable?: boolean
  structured?: (at: (path: string) => string) => readonly StructuredData[]
}

export type SiteMessages = Omit<Messages, `admin${string}`>

export type HeadTexts = { locale: Locale; messages: SiteMessages }

export type HeadArgs = {
  location: { pathname: string; search: string }
  params: { lang?: string }
  matches: readonly ({ id: string; loaderData?: unknown } | undefined)[]
}

export const siteName = 'Shionlib'

export const indexedLocale: Locale = 'zh'

const descriptionLength = 160

const ogLocales: Readonly<Record<Locale, string>> = { zh: 'zh_CN', en: 'en_US', ja: 'ja_JP' }

export function shareImage(
  path: string,
  alt: string,
  query?: Readonly<Record<string, string>>,
): ShareImage {
  return query === undefined ? { path, alt } : { path, alt, query }
}

export function clipped(text: string, length = descriptionLength): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  const chars = Array.from(flat)
  return chars.length <= length
    ? flat
    : `${chars
        .slice(0, length - 1)
        .join('')
        .trimEnd()}…`
}

export function pathOf(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
}

function pageOf(search: string): number | undefined {
  const params = new URLSearchParams(search)
  const page = Number.parseInt(params.get('page') ?? '', 10)
  const others = [...params.keys()].some(key => key !== 'page')
  if (others) {
    return undefined
  }
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

function imageAddress(site: Site, image: ShareImage, locale: Locale): string {
  const query = new URLSearchParams({ ...image.query, locale })
  return `${site.ogImageUrl}${image.path}?${query.toString()}`
}

export function pageMeta(args: HeadArgs, head: PageHead | undefined): MetaDescriptor[] {
  const site = siteFrom(args.matches.find(match => match?.id === 'root')?.loaderData)
  if (head === undefined || site === undefined) {
    return []
  }
  const locale = isLocale(args.params.lang) ? args.params.lang : defaultLocale
  const title = head.whole === true ? head.title : `${head.title} - ${siteName}`
  const page = pageOf(args.location.search)
  const indexable = head.indexable !== false && locale === indexedLocale && page !== undefined
  const path = pathOf(args.location.pathname)
  const url = `${site.siteUrl}${path}${page !== undefined && page > 1 ? `?page=${page}` : ''}`
  const image = head.image ?? shareImage('/default', siteName)
  const description = head.description === undefined ? undefined : clipped(head.description)
  const at = (target: string) => `${site.siteUrl}${target}`
  const tags: (MetaDescriptor | undefined)[] = [
    { title },
    description === undefined ? undefined : { name: 'description', content: description },
    { name: 'robots', content: indexable ? 'max-image-preview:large' : 'noindex, follow' },
    indexable ? { tagName: 'link', rel: 'canonical', href: url } : undefined,
    { property: 'og:type', content: head.kind ?? 'website' },
    { property: 'og:site_name', content: siteName },
    { property: 'og:title', content: head.title },
    description === undefined ? undefined : { property: 'og:description', content: description },
    { property: 'og:url', content: url },
    { property: 'og:locale', content: ogLocales[locale] },
    { property: 'og:image', content: imageAddress(site, image, locale) },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:alt', content: image.alt },
    { name: 'twitter:card', content: 'summary_large_image' },
    ...(head.structured?.(at) ?? []).map(data => ({
      'script:ld+json': { '@context': 'https://schema.org', ...data },
    })),
  ]
  return tags.filter(tag => tag !== undefined)
}
