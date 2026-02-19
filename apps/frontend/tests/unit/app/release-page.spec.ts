import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const get = vi.fn()
  const requestFactory = vi.fn(() => ({
    get,
  }))

  const getTranslations = vi.fn()

  const ReleaseListHeader = vi.fn(() =>
    React.createElement('header', { 'data-testid': 'release-header' }, 'header'),
  )

  const Releases = vi.fn(
    ({ releases, meta }: { releases: Array<{ id: number }>; meta: { total: number } }) =>
      React.createElement(
        'section',
        {
          'data-testid': 'releases',
          'data-count': String(releases.length),
          'data-total': String(meta.total),
        },
        'releases',
      ),
  )

  return {
    get,
    requestFactory,
    getTranslations,
    ReleaseListHeader,
    Releases,
  }
})

vi.mock('@/utils/request', () => ({
  shionlibRequest: hoisted.requestFactory,
}))

vi.mock('next-intl/server', () => ({
  getTranslations: hoisted.getTranslations,
}))

vi.mock('@/components/release/list/Header', () => ({
  ReleaseListHeader: hoisted.ReleaseListHeader,
}))

vi.mock('@/components/release/list/Releases', () => ({
  Releases: hoisted.Releases,
}))

describe('app/[locale]/(main)/release/page (unit)', () => {
  beforeEach(() => {
    hoisted.get.mockReset()
    hoisted.requestFactory.mockClear()
    hoisted.getTranslations.mockReset()
  })

  it('fetches release list and renders header/results', async () => {
    hoisted.get.mockResolvedValue({
      data: {
        items: [{ id: 1 }, { id: 2 }],
        meta: { total: 2 },
      },
    })

    const pageModule = await import('../../../app/[locale]/(main)/release/page')
    const element = await pageModule.default({ searchParams: Promise.resolve({ page: 3 as any }) })

    expect(hoisted.get).toHaveBeenCalledWith('/game/download-source/list', {
      params: {
        page: 3,
        pageSize: 25,
      },
    })

    const html = renderToStaticMarkup(element)
    expect(html).toContain('data-testid="release-header"')
    expect(html).toContain('data-testid="releases"')
    expect(html).toContain('data-count="2"')
    expect(html).toContain('data-total="2"')
  })

  it('builds metadata from i18n messages', async () => {
    hoisted.getTranslations.mockResolvedValue((key: string) => `release-${key}`)

    const pageModule = await import('../../../app/[locale]/(main)/release/page')
    const metadata = await pageModule.generateMetadata({
      params: Promise.resolve({ locale: 'ja' }),
    } as any)

    expect(metadata.title).toBe('release-title')
    expect(metadata.description).toBe('release-description')
    expect(metadata.alternates?.canonical).toBe('/ja/release')
  })
})
