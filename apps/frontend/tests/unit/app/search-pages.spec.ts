import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const redirect = vi.fn((path: string) => `redirect:${path}`)
  const notFound = vi.fn(() => {
    throw new Error('NOT_FOUND')
  })
  const get = vi.fn()
  const requestFactory = vi.fn(() => ({ get }))
  const getTranslations = vi.fn()

  const Results = vi.fn(
    ({
      games,
      q,
      tag,
      content_limit,
    }: {
      games: Array<{ id: number }>
      q?: string
      tag?: string
      content_limit: any
    }) =>
      React.createElement(
        'section',
        {
          'data-testid': 'search-results',
          'data-count': String(games.length),
          'data-q': q ?? '',
          'data-tag': tag ?? '',
          'data-limit': String(content_limit),
        },
        'results',
      ),
  )

  return {
    redirect,
    notFound,
    get,
    requestFactory,
    getTranslations,
    Results,
  }
})

vi.mock('next/navigation', () => ({
  redirect: hoisted.redirect,
  notFound: hoisted.notFound,
}))

vi.mock('@/utils/request', () => ({
  shionlibRequest: hoisted.requestFactory,
}))

vi.mock('next-intl/server', () => ({
  getTranslations: hoisted.getTranslations,
}))

vi.mock('@/components/common/search/game/Results', () => ({
  Results: hoisted.Results,
}))

describe('app/[locale]/(main)/search/page and /search/game/page (unit)', () => {
  beforeEach(() => {
    hoisted.redirect.mockClear()
    hoisted.notFound.mockClear()
    hoisted.get.mockReset()
    hoisted.requestFactory.mockClear()
    hoisted.getTranslations.mockReset()
  })

  it('search index redirects to /search/game', async () => {
    const pageModule = await import('../../../app/[locale]/(main)/search/page')
    const result = pageModule.default()

    expect(hoisted.redirect).toHaveBeenCalledWith('/search/game')
    expect(result).toBe('redirect:/search/game')
  })

  it('search game page calls notFound when q is missing', async () => {
    const pageModule = await import('../../../app/[locale]/(main)/search/game/page')

    await expect(
      pageModule.default({
        searchParams: Promise.resolve({ page: '1', q: '' }),
      }),
    ).rejects.toThrow('NOT_FOUND')

    expect(hoisted.notFound).toHaveBeenCalledTimes(1)
    expect(hoisted.get).not.toHaveBeenCalled()
  })

  it('search game fetches data and renders results', async () => {
    hoisted.get.mockResolvedValue({
      data: {
        items: [{ id: 10 }, { id: 11 }],
        meta: {
          page: 2,
          pageSize: 20,
          total: 2,
          content_limit: 3,
        },
      },
    })

    const pageModule = await import('../../../app/[locale]/(main)/search/game/page')
    const element = await pageModule.default({
      searchParams: Promise.resolve({ page: '2', q: 'fate' }),
    })

    expect(hoisted.get).toHaveBeenCalledWith('/search/games', {
      params: {
        page: '2',
        pageSize: 20,
        q: 'fate',
      },
    })

    const html = renderToStaticMarkup(element)
    expect(html).toContain('data-testid="search-results"')
    expect(html).toContain('data-count="2"')
    expect(html).toContain('data-q="fate"')
    expect(html).toContain('data-tag=""')
    expect(html).toContain('data-limit="3"')
  })

  it('search game supports tag-only filtering', async () => {
    hoisted.get.mockResolvedValue({
      data: {
        items: [{ id: 20 }],
        meta: {
          page: 1,
          pageSize: 20,
          total: 1,
          content_limit: 2,
        },
      },
    })

    const pageModule = await import('../../../app/[locale]/(main)/search/game/page')
    const element = await pageModule.default({
      searchParams: Promise.resolve({ page: '1', tag: 'otome' }),
    })

    expect(hoisted.get).toHaveBeenCalledWith('/search/games', {
      params: {
        page: '1',
        pageSize: 20,
        tag: 'otome',
      },
    })

    const html = renderToStaticMarkup(element)
    expect(html).toContain('data-q=""')
    expect(html).toContain('data-tag="otome"')
  })

  it('search game metadata supports tag-only canonical url', async () => {
    hoisted.getTranslations.mockResolvedValue(
      (key: string, params: { q: string }) => `${key}:${params.q}`,
    )

    const pageModule = await import('../../../app/[locale]/(main)/search/game/page')
    const metadata = await pageModule.generateMetadata({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({ tag: 'otome', page: '2' }),
    } as any)

    expect(metadata.title).toBe('title:otome')
    expect(metadata.alternates?.canonical).toBe('/en/search/game?tag=otome&page=2')
  })

  it('search game metadata uses localized title and noindex robots', async () => {
    hoisted.getTranslations.mockResolvedValue(
      (key: string, params: { q: string }) => `${key}:${params.q}`,
    )

    const pageModule = await import('../../../app/[locale]/(main)/search/game/page')
    const metadata = await pageModule.generateMetadata({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({ q: 'clannad', page: '3' }),
    } as any)

    expect(metadata.title).toBe('title:clannad')
    expect(metadata.alternates?.canonical).toBe('/en/search/game?q=clannad&page=3')
    expect(metadata.robots).toMatchObject({ index: false, follow: false })
  })
})
