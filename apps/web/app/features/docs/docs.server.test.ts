import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeAll, describe, expect, it } from 'vitest'
import { locales, type Locale } from '~/shared/i18n/locale'
import { isRetired, isSitePath, sitePath, type Doc } from './docs'
import { docsIn } from './docs.server'
import { readPage } from './docs-content'
import { pictureSizeFrom } from './docs.schema'

type Read = {
  links: string[]
  anchors: string[]
  listed: string[]
  pictures: unknown[]
}

const reads = new Map<string, Read>()

const keyOf = (locale: Locale, doc: Doc) => `/${locale}/docs/${doc.category}/${doc.name}`

async function read(locale: Locale, doc: Doc): Promise<Read> {
  const page = await readPage(locale, doc)
  const links: string[] = []
  const pictures: unknown[] = []
  const html = renderToStaticMarkup(
    createElement(page.default, {
      components: {
        a: ({ href = '', children }: { href?: string; children?: ReactNode }) => {
          links.push(href)
          return children
        },
        img: (picture: { width?: unknown; height?: unknown }) => {
          pictures.push(pictureSizeFrom(picture))
          return null
        },
        Ellipsis: () => null,
      },
    }),
  )
  return {
    links,
    pictures,
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
  it('are the same ones in every language, in the order they are read', () => {
    const names = (locale: Locale) => docsIn(locale).map(doc => `${doc.category}/${doc.name}`)
    expect(names('zh')).toEqual([
      'guides/download-games',
      'guides/decompress-zstd-files',
      'guides/how-to-play-raw-galgame',
      'guides/common-vn-engines-and-emulators',
      'guides/lunabox',
      'guides/reina',
      'guides/potatovn-download',
      'guides/upload-game-files',
      'guides/resource-maintenance',
      'guides/walkthrough',
      'guides/favorites',
      'guides/account-settings',
      'about/about-shionlib',
      'dev/dev-overview',
      'dev/open-api',
    ])
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

  it('know the size of every picture they show, and show the same number in every language', () => {
    for (const [address, page] of reads) {
      expect(page.pictures, address).not.toContain(undefined)
    }
    const shown = (locale: Locale) =>
      docsIn(locale).map(doc => reads.get(keyOf(locale, doc))?.pictures.length)
    expect(shown('en')).toEqual(shown('zh'))
    expect(shown('ja')).toEqual(shown('zh'))
  })

  it('hold none of the documents that were taken down', () => {
    for (const locale of locales) {
      expect(docsIn(locale).filter(isRetired), locale).toEqual([])
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
