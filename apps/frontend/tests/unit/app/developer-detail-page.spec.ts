import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const notFound = vi.fn(() => {
    throw new Error('NOT_FOUND')
  })
  const get = vi.fn()
  const requestFactory = vi.fn(() => ({ get }))
  const getPreferredDeveloperContent = vi.fn()

  const DeveloperContent = vi.fn(
    ({ works_count, content_limit }: { works_count: number; content_limit: number }) =>
      React.createElement(
        'section',
        {
          'data-testid': 'developer-content',
          'data-works': String(works_count),
          'data-limit': String(content_limit),
        },
        'content',
      ),
  )

  return {
    notFound,
    get,
    requestFactory,
    getPreferredDeveloperContent,
    DeveloperContent,
  }
})

vi.mock('next/navigation', () => ({
  notFound: hoisted.notFound,
}))

vi.mock('@/utils/request', () => ({
  shionlibRequest: hoisted.requestFactory,
}))

vi.mock('@/components/developer/DeveloperContent', () => ({
  DeveloperContent: hoisted.DeveloperContent,
}))

vi.mock('@/components/game/description/helpers/getPreferredContent', () => ({
  getPreferredDeveloperContent: hoisted.getPreferredDeveloperContent,
}))

describe('app/[locale]/(main)/developer/[id]/page (unit)', () => {
  beforeEach(() => {
    hoisted.notFound.mockClear()
    hoisted.get.mockReset()
    hoisted.requestFactory.mockClear()
    hoisted.getPreferredDeveloperContent.mockReset()
  })

  it('fetches developer + games and renders content', async () => {
    hoisted.get
      .mockResolvedValueOnce({
        data: { id: 12, name: 'Dev 12', aliases: ['Alias'], logo: '/logo.png' },
      })
      .mockResolvedValueOnce({
        data: {
          items: [{ id: 1 }],
          meta: { totalItems: 9, content_limit: 2 },
        },
      })

    const pageModule = await import('../../../app/[locale]/(main)/developer/[id]/page')
    const element = await pageModule.default({
      params: Promise.resolve({ id: '12' }),
      searchParams: Promise.resolve({ page: '3' }),
    })

    expect(hoisted.get).toHaveBeenNthCalledWith(1, '/developer/12')
    expect(hoisted.get).toHaveBeenNthCalledWith(2, '/game/list', {
      params: {
        page: '3',
        pageSize: 15,
        developer_id: '12',
      },
    })

    const html = renderToStaticMarkup(element)
    expect(html).toContain('data-testid="developer-content"')
    expect(html).toContain('data-works="9"')
    expect(html).toContain('data-limit="2"')
  })

  it('builds metadata from developer detail and preferred intro', async () => {
    hoisted.get.mockResolvedValue({
      data: {
        id: 12,
        name: 'Dev Meta',
        aliases: ['Alias'],
        logo: '/dev.png',
      },
    })
    hoisted.getPreferredDeveloperContent.mockReturnValue({
      intro: 'Developer intro line that should be used as description.',
    })

    const pageModule = await import('../../../app/[locale]/(main)/developer/[id]/page')
    const metadata = await pageModule.generateMetadata({
      params: Promise.resolve({ locale: 'en', id: '12' }),
    } as any)

    expect(hoisted.get).toHaveBeenCalledWith('/developer/12')
    expect(hoisted.getPreferredDeveloperContent).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Dev Meta' }),
      'en',
    )
    expect(metadata.title).toBe('Dev Meta')
    expect(metadata.description).toContain('Developer intro line')
    expect(metadata.alternates?.canonical).toBe('/en/developer/12')
  })
})
