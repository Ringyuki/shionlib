import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const getAllDocs = vi.fn()
  const getTranslations = vi.fn()

  const DocCard = vi.fn(({ doc }: { doc: { slug: string; title: string } }) =>
    React.createElement('article', { 'data-testid': 'doc-card', 'data-slug': doc.slug }, doc.title),
  )

  const Masonry = vi.fn(
    ({ children, className }: { children: React.ReactNode; className?: string }) =>
      React.createElement('section', { 'data-testid': 'masonry', className }, children),
  )

  return {
    getAllDocs,
    getTranslations,
    DocCard,
    Masonry,
  }
})

vi.mock('@/libs/docs/getDocs', () => ({
  getAllDocs: hoisted.getAllDocs,
}))

vi.mock('next-intl/server', () => ({
  getTranslations: hoisted.getTranslations,
}))

vi.mock('@/components/docs/DocCard', () => ({
  DocCard: hoisted.DocCard,
}))

vi.mock('@/components/common/shared/Masonry', () => ({
  Masonry: hoisted.Masonry,
}))

describe('app/[locale]/(main)/docs/page (unit)', () => {
  beforeEach(() => {
    hoisted.getAllDocs.mockReset()
    hoisted.getTranslations.mockReset()
    hoisted.DocCard.mockClear()
    hoisted.Masonry.mockClear()
  })

  it('renders docs list by locale', async () => {
    hoisted.getAllDocs.mockReturnValue([
      { slug: 'intro', title: 'Intro' },
      { slug: 'advanced', title: 'Advanced' },
    ])

    const pageModule = await import('../../../app/[locale]/(main)/docs/page')
    const element = await pageModule.default({ params: Promise.resolve({ locale: 'zh' }) })

    expect(hoisted.getAllDocs).toHaveBeenCalledWith('zh')

    const html = renderToStaticMarkup(element)
    expect(html).toContain('data-testid="masonry"')
    expect(html).toContain('data-slug="intro"')
    expect(html).toContain('data-slug="advanced"')
  })

  it('builds metadata from translations', async () => {
    hoisted.getTranslations.mockResolvedValue((key: string) => `docs-${key}`)

    const pageModule = await import('../../../app/[locale]/(main)/docs/page')
    const metadata = await pageModule.generateMetadata({
      params: Promise.resolve({ locale: 'ja' }),
    } as any)

    expect(metadata.title).toBe('docs-title')
    expect(metadata.alternates?.canonical).toBe('/ja/docs')
  })
})
