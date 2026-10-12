import type { MDXContent } from 'mdx/types'
import type { Locale } from '~/shared/i18n/locale'
import type { DocRef } from './docs'

export type Section = {
  id: string
  label: string
  children: Section[]
}

export type Page = {
  default: MDXContent
  sections: Section[]
}

const pages = import.meta.glob<Page>('./content/*/*/*.mdx')

const reading = new Map<string, Promise<Page>>()

export function readPage(locale: Locale, doc: DocRef): Promise<Page> {
  const file = `./content/${locale}/${doc.category}/${doc.name}.mdx`
  const started = reading.get(file)
  if (started !== undefined) {
    return started
  }
  const load = pages[file]
  if (load === undefined) {
    throw new Error(`There is no document ${doc.category}/${doc.name} in ${locale}`)
  }
  const page = load()
  reading.set(file, page)
  page.catch(() => reading.delete(file))
  return page
}
