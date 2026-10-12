import { data, type LoaderFunctionArgs } from 'react-router'
import { defaultLocale, locales, type Locale } from '~/shared/i18n/locale'
import { isLocale } from '~/shared/i18n/locale.schema'
import { inOrder, neighboursOf, sameDoc, type Doc, type DocLink } from './docs'
import { categoryFrom, docFrom } from './docs.schema'

const heads = import.meta.glob('./content/*/*/*.mdx', { eager: true, import: 'frontmatter' })

function shelve(): Record<Locale, Doc[]> {
  const shelves: Record<Locale, Doc[]> = { zh: [], en: [], ja: [] }
  for (const [file, head] of Object.entries(heads)) {
    const [, , locale, folder, leaf = ''] = file.split('/')
    const category = categoryFrom(folder)
    const doc =
      category === undefined
        ? undefined
        : docFrom({ category, name: leaf.replace(/\.mdx$/, '') }, head)
    if (!isLocale(locale) || doc === undefined) {
      throw new Error(`The document ${file} has no place or no valid head`)
    }
    shelves[locale].push(doc)
  }
  for (const locale of locales) {
    shelves[locale] = inOrder(shelves[locale])
  }
  return shelves
}

const shelves = shelve()

export function docsIn(locale: Locale): readonly Doc[] {
  return shelves[locale]
}

function localeOf({ params }: LoaderFunctionArgs): Locale {
  return isLocale(params.lang) ? params.lang : defaultLocale
}

function linkOf({ category, name, title }: Doc): DocLink {
  return { category, name, title }
}

export function docsLoader(args: LoaderFunctionArgs) {
  return { docs: docsIn(localeOf(args)) }
}

export function docLoader(args: LoaderFunctionArgs) {
  const docs = docsIn(localeOf(args))
  const category = categoryFrom(args.params.category)
  const doc =
    category === undefined
      ? undefined
      : docs.find(entry => sameDoc(entry, { category, name: args.params.name ?? '' }))
  if (doc === undefined) {
    throw data(null, { status: 404 })
  }
  const { previous, next } = neighboursOf(docs, doc)
  return {
    doc,
    shelf: docs.map(linkOf),
    previous: previous === undefined ? undefined : linkOf(previous),
    next: next === undefined ? undefined : linkOf(next),
  }
}
