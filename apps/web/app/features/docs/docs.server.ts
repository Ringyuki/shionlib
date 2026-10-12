import { data, redirect, type LoaderFunctionArgs } from 'react-router'
import { defaultLocale, locales, type Locale } from '~/shared/i18n/locale'
import { isLocale } from '~/shared/i18n/locale.schema'
import {
  docsPath,
  inOrder,
  isRetired,
  neighboursOf,
  sameDoc,
  type Doc,
  type DocLink,
  type DocRef,
} from './docs'
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

function askedFor({ params }: LoaderFunctionArgs): DocRef | undefined {
  const category = categoryFrom(params.category)
  return category === undefined ? undefined : { category, name: params.name ?? '' }
}

export function docLoader(args: LoaderFunctionArgs) {
  const locale = localeOf(args)
  const docs = docsIn(locale)
  const asked = askedFor(args)
  const doc = asked === undefined ? undefined : docs.find(entry => sameDoc(entry, asked))
  if (doc === undefined) {
    if (asked !== undefined && isRetired(asked)) {
      throw redirect(docsPath(locale), 301)
    }
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
