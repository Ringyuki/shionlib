import { locales, type Locale } from '~/shared/i18n/locale'

export const categories = ['guides', 'about', 'dev'] as const

export type Category = (typeof categories)[number]

export type DocRef = {
  category: Category
  name: string
}

export type DocAuthor = {
  id: number | undefined
  name: string
  avatar: string | undefined
}

export type Doc = DocRef & {
  title: string
  description: string
  banner: string | undefined
  date: string
  author: DocAuthor | undefined
}

export type DocLink = DocRef & {
  title: string
}

export type PictureSize = {
  width: number
  height: number
}

export function docsPath(locale: Locale): string {
  return `/${locale}/docs`
}

export function docPath(locale: Locale, doc: DocRef): string {
  return `${docsPath(locale)}/${doc.category}/${doc.name}`
}

export function sameDoc(a: DocRef, b: DocRef): boolean {
  return a.category === b.category && a.name === b.name
}

const retired: readonly DocRef[] = [
  { category: 'guides', name: 'edit-history-and-undo' },
  { category: 'guides', name: 'edit-info' },
  { category: 'guides', name: 'potatovn-sync' },
]

export function isRetired(doc: DocRef): boolean {
  return retired.some(entry => sameDoc(entry, doc))
}

export function inOrder<Entry extends DocRef & { date: string }>(docs: readonly Entry[]): Entry[] {
  return docs.toSorted(
    (a, b) =>
      categories.indexOf(a.category) - categories.indexOf(b.category) ||
      b.date.localeCompare(a.date) ||
      a.name.localeCompare(b.name),
  )
}

export type DocGroup<Entry> = {
  category: Category
  docs: Entry[]
}

export function grouped<Entry extends DocRef>(docs: readonly Entry[]): DocGroup<Entry>[] {
  return categories
    .map(category => ({ category, docs: docs.filter(doc => doc.category === category) }))
    .filter(group => group.docs.length > 0)
}

export type Neighbours<Entry> = {
  previous: Entry | undefined
  next: Entry | undefined
}

export function neighboursOf<Entry extends DocRef>(
  docs: readonly Entry[],
  current: DocRef,
): Neighbours<Entry> {
  const at = docs.findIndex(doc => sameDoc(doc, current))
  if (at === -1) {
    return { previous: undefined, next: undefined }
  }
  return { previous: at > 0 ? docs[at - 1] : undefined, next: docs[at + 1] }
}

const sources = 'https://github.com/Ringyuki/shionlib/edit/main/apps/web/app/features/docs/content'

export function sourceUrl(locale: Locale, doc: DocRef): string {
  return `${sources}/${locale}/${doc.category}/${doc.name}.mdx`
}

export function isSitePath(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//')
}

export function sitePath(locale: Locale, href: string): string {
  const [, first] = href.split('/')
  if (locales.some(known => known === first)) {
    return href
  }
  return `/${locale}${href === '/' ? '' : href}`
}
