import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SortBy, SortOrder } from '../../../components/game/filter/enums/Sort.enum'

const hoisted = vi.hoisted(() => {
  const get = vi.fn()
  const requestFactory = vi.fn(() => ({ get }))
  const parseGameSearchParams = vi.fn()
  const getTranslations = vi.fn()

  const Header = vi.fn(() => React.createElement('header', { 'data-testid': 'game-header' }, 'h'))
  const GameFilter = vi.fn(({ initialTags }: { initialTags: string[] }) =>
    React.createElement(
      'section',
      { 'data-testid': 'game-filter', 'data-tags': initialTags.join(',') },
      'f',
    ),
  )
  const Games = vi.fn(
    ({ games, content_limit }: { games: Array<{ id: number }>; content_limit: number }) =>
      React.createElement(
        'section',
        {
          'data-testid': 'game-results',
          'data-count': String(games.length),
          'data-limit': String(content_limit),
        },
        'g',
      ),
  )

  return {
    get,
    requestFactory,
    parseGameSearchParams,
    getTranslations,
    Header,
    GameFilter,
    Games,
  }
})

vi.mock('@/utils/request', () => ({
  shionlibRequest: hoisted.requestFactory,
}))

vi.mock('@/libs/game/useGameList', () => ({
  parseGameSearchParams: hoisted.parseGameSearchParams,
}))

vi.mock('next-intl/server', () => ({
  getTranslations: hoisted.getTranslations,
}))

vi.mock('@/components/game/filter/Header', () => ({ Header: hoisted.Header }))
vi.mock('@/components/game/filter/GameFilter', () => ({ GameFilter: hoisted.GameFilter }))
vi.mock('@/components/game/filter/Games', () => ({ Games: hoisted.Games }))

describe('app/[locale]/(main)/game/page (unit)', () => {
  beforeEach(() => {
    hoisted.get.mockReset()
    hoisted.requestFactory.mockClear()
    hoisted.parseGameSearchParams.mockReset()
    hoisted.getTranslations.mockReset()
  })

  it('parses query, fetches game list and renders filter/results', async () => {
    hoisted.parseGameSearchParams.mockReturnValue({
      filter: {
        tags: ['tag-a'],
        years: [2024],
        months: [7],
        sort_by: SortBy.RELEASE_DATE,
        sort_order: SortOrder.DESC,
      },
      page: 2,
    })

    hoisted.get.mockResolvedValue({
      data: {
        items: [{ id: 1 }, { id: 2 }],
        meta: {
          totalItems: 2,
          content_limit: 5,
        },
      },
    })

    const pageModule = await import('../../../app/[locale]/(main)/game/page')
    const element = await pageModule.default({ searchParams: Promise.resolve({ q: 'any' } as any) })

    expect(hoisted.parseGameSearchParams).toHaveBeenCalled()
    const calledUrl = String(hoisted.get.mock.calls[0][0])
    expect(calledUrl).toContain('/game/list?')
    expect(calledUrl).toContain('pageSize=20')
    expect(calledUrl).toContain('filter%5Bsort_by%5D=release_date')

    const html = renderToStaticMarkup(element)
    expect(html).toContain('data-testid="game-header"')
    expect(html).toContain('data-testid="game-filter"')
    expect(html).toContain('data-tags="tag-a"')
    expect(html).toContain('data-testid="game-results"')
    expect(html).toContain('data-count="2"')
    expect(html).toContain('data-limit="5"')
  })

  it('builds metadata from i18n', async () => {
    hoisted.getTranslations.mockResolvedValue((key: string) => `game-${key}`)

    const pageModule = await import('../../../app/[locale]/(main)/game/page')
    const metadata = await pageModule.generateMetadata({
      params: Promise.resolve({ locale: 'en' }),
    } as any)

    expect(metadata.title).toBe('game-title')
    expect(metadata.description).toBe('game-description')
    expect(metadata.alternates?.canonical).toBe('/en/game')
  })
})
