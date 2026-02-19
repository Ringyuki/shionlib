import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const getAdjacentDocs = vi.fn()
  const getDocBySlug = vi.fn()

  const DocTOC = vi.fn(() => React.createElement('aside', { 'data-testid': 'doc-toc' }, 'toc'))
  const DocHeader = vi.fn(({ frontmatter }: { frontmatter: { title?: string } }) =>
    React.createElement('header', { 'data-testid': 'doc-header' }, frontmatter.title || ''),
  )
  const DocNav = vi.fn(() => React.createElement('nav', { 'data-testid': 'doc-nav' }, 'nav'))
  const Mdx = vi.fn(({ source }: { source: string }) =>
    React.createElement('div', { 'data-testid': 'doc-mdx' }, source),
  )
  const DocFooter = vi.fn(({ slug }: { slug: string }) =>
    React.createElement('footer', { 'data-testid': 'doc-footer' }, slug),
  )

  return {
    getAdjacentDocs,
    getDocBySlug,
    DocTOC,
    DocHeader,
    DocNav,
    Mdx,
    DocFooter,
  }
})

vi.mock('@/libs/docs/getDocs', () => ({
  getAdjacentDocs: hoisted.getAdjacentDocs,
  getDocBySlug: hoisted.getDocBySlug,
}))

vi.mock('@/components/docs/content/DocTOC', () => ({
  DocTOC: hoisted.DocTOC,
}))
vi.mock('@/components/docs/content/DocHeader', () => ({
  DocHeader: hoisted.DocHeader,
}))
vi.mock('@/components/docs/content/DocNav', () => ({
  DocNav: hoisted.DocNav,
}))
vi.mock('@/components/docs/content/MDX', () => ({
  Mdx: hoisted.Mdx,
}))
vi.mock('@/components/docs/content/DocFooter', () => ({
  DocFooter: hoisted.DocFooter,
}))

describe('app/[locale]/(main)/docs/[...slug]/page (unit)', () => {
  beforeEach(() => {
    hoisted.getAdjacentDocs.mockReset()
    hoisted.getDocBySlug.mockReset()
  })

  it('renders doc content and navigation by slug', async () => {
    hoisted.getAdjacentDocs.mockReturnValue({ prev: null, next: { slug: 'n' } })
    hoisted.getDocBySlug.mockReturnValue({
      frontmatter: { title: 'Doc A', description: 'desc' },
      content: '# hello',
    })

    const pageModule = await import('../../../app/[locale]/(main)/docs/[...slug]/page')
    const element = await pageModule.default({
      params: Promise.resolve({ locale: 'en', slug: ['guide', 'intro'] }),
    })

    expect(hoisted.getAdjacentDocs).toHaveBeenCalledWith('guide/intro', 'en')
    expect(hoisted.getDocBySlug).toHaveBeenCalledWith('guide/intro', 'en')

    const html = renderToStaticMarkup(element)
    expect(html).toContain('data-testid="doc-header"')
    expect(html).toContain('Doc A')
    expect(html).toContain('data-testid="doc-mdx"')
    expect(html).toContain('# hello')
    expect(html).toContain('data-testid="doc-footer"')
    expect(html).toContain('guide/intro')
    expect(html).toContain('data-testid="doc-nav"')
    expect(html).toContain('data-testid="doc-toc"')
  })

  it('builds metadata from frontmatter and slug', async () => {
    hoisted.getDocBySlug.mockReturnValue({
      frontmatter: { title: 'Doc Meta', description: 'Meta Desc' },
      content: 'content',
    })

    const pageModule = await import('../../../app/[locale]/(main)/docs/[...slug]/page')
    const metadata = await pageModule.generateMetadata({
      params: Promise.resolve({ locale: 'zh', slug: ['topic', 'a'] }),
    } as any)

    expect(hoisted.getDocBySlug).toHaveBeenCalledWith('topic/a', 'zh')
    expect(metadata.title).toBe('Doc Meta')
    expect(metadata.description).toBe('Meta Desc')
    expect(metadata.alternates?.canonical).toBe('/zh/docs/topic/a')
  })
})
