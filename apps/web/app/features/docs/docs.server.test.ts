import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeAll, describe, expect, it } from 'vitest'
import { locales, type Locale } from '~/shared/i18n/locale'
import { isSitePath, sitePath, type Doc } from './docs'
import { docsIn } from './docs.server'
import { readPage } from './docs-content'

type Read = {
  links: string[]
  anchors: string[]
  listed: string[]
}

const reads = new Map<string, Read>()

const keyOf = (locale: Locale, doc: Doc) => `/${locale}/docs/${doc.category}/${doc.name}`

async function read(locale: Locale, doc: Doc): Promise<Read> {
  const page = await readPage(locale, doc)
  const links: string[] = []
  const html = renderToStaticMarkup(
    createElement(page.default, {
      components: {
        a: ({ href = '', children }: { href?: string; children?: ReactNode }) => {
          links.push(href)
          return children
        },
        Ellipsis: () => null,
      },
    }),
  )
  return {
    links,
    anchors: [...html.matchAll(/<h[1-6] id="([^"]+)"/g)].map(([, id = '']) => id),
    listed: page.sections.flatMap(section => [section.id, ...section.children.map(sub => sub.id)]),
  }
}

beforeAll(async () => {
  for (const locale of locales) {
    for (const doc of docsIn(locale)) {
      reads.set(keyOf(locale, doc), await read(locale, doc))
    }
  }
})

describe('the documents in the repository', () => {
  it('are the same ones in every language, in the same order', () => {
    const names = (locale: Locale) => docsIn(locale).map(doc => `${doc.category}/${doc.name}`)
    expect(names('zh')).toHaveLength(17)
    expect(names('en')).toEqual(names('zh'))
    expect(names('ja')).toEqual(names('zh'))
  })

  it('all render, and list in their contents only headings they have', () => {
    for (const [address, page] of reads) {
      expect(page.listed.length, address).toBeGreaterThan(0)
      expect(
        page.listed.filter(id => !page.anchors.includes(id)),
        address,
      ).toEqual([])
      expect(new Set(page.anchors).size, address).toBe(page.anchors.length)
    }
  })

  it('link only to documents that exist', () => {
    for (const locale of locales) {
      for (const doc of docsIn(locale)) {
        const address = keyOf(locale, doc)
        const missing = (reads.get(address)?.links ?? [])
          .filter(isSitePath)
          .map(link => sitePath(locale, link).split('#')[0] ?? '')
          .filter(link => link.includes('/docs/') && !reads.has(link))
        expect(missing, address).toEqual([])
      }
    }
  })
})
