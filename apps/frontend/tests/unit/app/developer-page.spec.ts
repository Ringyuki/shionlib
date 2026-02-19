import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const get = vi.fn()
  const requestFactory = vi.fn(() => ({ get }))
  const getTranslations = vi.fn()

  const Header = vi.fn(() => React.createElement('header', { 'data-testid': 'dev-header' }, 'h'))
  const Search = vi.fn(({ initialQ }: { initialQ: string }) =>
    React.createElement('div', { 'data-testid': 'dev-search', 'data-q': initialQ }, 's'),
  )
  const Developers = vi.fn(
    ({
      developers,
      extraQuery,
    }: {
      developers: Array<{ id: number }>
      extraQuery: { q: string }
    }) =>
      React.createElement(
        'section',
        {
          'data-testid': 'dev-list',
          'data-count': String(developers.length),
          'data-q': extraQuery.q,
        },
        'd',
      ),
  )

  return {
    get,
    requestFactory,
    getTranslations,
    Header,
    Search,
    Developers,
  }
})

vi.mock('@/utils/request', () => ({
  shionlibRequest: hoisted.requestFactory,
}))

vi.mock('next-intl/server', () => ({
  getTranslations: hoisted.getTranslations,
}))

vi.mock('@/components/developer/list/Header', () => ({ Header: hoisted.Header }))
vi.mock('@/components/developer/list/Search', () => ({ Search: hoisted.Search }))
vi.mock('@/components/developer/list/Developers', () => ({ Developers: hoisted.Developers }))

describe('app/[locale]/(main)/developer/page (unit)', () => {
  beforeEach(() => {
    hoisted.get.mockReset()
    hoisted.requestFactory.mockClear()
    hoisted.getTranslations.mockReset()
  })

  it('fetches developers and renders search/list blocks', async () => {
    hoisted.get.mockResolvedValue({
      data: {
        items: [{ id: 1 }, { id: 2 }],
        meta: { total: 2 },
      },
    })

    const pageModule = await import('../../../app/[locale]/(main)/developer/page')
    const element = await pageModule.default({
      searchParams: Promise.resolve({ page: 2, q: 'key' }),
    })

    expect(hoisted.get).toHaveBeenCalledWith('/developer/list', {
      params: {
        page: 2,
        pageSize: 50,
        q: 'key',
      },
    })

    const html = renderToStaticMarkup(element)
    expect(html).toContain('data-testid="dev-header"')
    expect(html).toContain('data-testid="dev-search"')
    expect(html).toContain('data-q="key"')
    expect(html).toContain('data-testid="dev-list"')
    expect(html).toContain('data-count="2"')
  })

  it('builds metadata from i18n', async () => {
    hoisted.getTranslations.mockResolvedValue((key: string) => `developer-${key}`)

    const pageModule = await import('../../../app/[locale]/(main)/developer/page')
    const metadata = await pageModule.generateMetadata({
      params: Promise.resolve({ locale: 'zh' }),
    } as any)

    expect(metadata.title).toBe('developer-title')
    expect(metadata.description).toBe('developer-description')
    expect(metadata.alternates?.canonical).toBe('/zh/developer')
  })
})
