import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const hasLocale = vi.fn(() => true)
  const notFound = vi.fn(() => {
    throw new Error('NOT_FOUND')
  })
  const get = vi.fn()
  const requestFactory = vi.fn(() => ({ get }))
  const createGenerateMetadata = vi.fn((resolver: (args: any) => Promise<any> | any) => {
    return async ({ params }: { params: any | Promise<any> }) => {
      const awaited = params && typeof (params as any).then === 'function' ? await params : params
      return resolver(awaited ?? {})
    }
  })
  const getPreferredContent = vi.fn((_: unknown, key: string, lang: string) => {
    if (key === 'title') return { title: `${lang}-title` }
    if (key === 'cover') return { cover: { url: `${lang}-cover-url` }, aspect: '1 / 1.5' }
    if (key === 'intro') return { intro: 'line-1\nline-2' }
    return {}
  })

  const ViewPing = vi.fn(() => React.createElement('section', { 'data-testid': 'view-ping' }))
  const GameHeader = vi.fn(({ game }: { game: { id: number } }) =>
    React.createElement('section', { 'data-testid': 'game-header', 'data-id': String(game.id) }),
  )
  const Ad = vi.fn(({ id }: { id: number }) =>
    React.createElement('section', { 'data-testid': 'ad', 'data-id': String(id) }),
  )
  const GameTabsNav = vi.fn(() => React.createElement('section', { 'data-testid': 'game-tabs' }))

  return {
    hasLocale,
    notFound,
    get,
    requestFactory,
    createGenerateMetadata,
    getPreferredContent,
    ViewPing,
    GameHeader,
    Ad,
    GameTabsNav,
  }
})

vi.mock('next-intl', () => ({
  hasLocale: hoisted.hasLocale,
}))
vi.mock('next/navigation', () => ({
  notFound: hoisted.notFound,
}))
vi.mock('@/utils/request', () => ({
  shionlibRequest: hoisted.requestFactory,
}))
vi.mock('@/libs/seo/metadata', () => ({
  createGenerateMetadata: hoisted.createGenerateMetadata,
}))
vi.mock('@/components/game/description/helpers/getPreferredContent', () => ({
  getPreferredContent: hoisted.getPreferredContent,
}))
vi.mock('@/i18n/routing', () => ({
  routing: { locales: ['en', 'zh', 'ja'] },
}))
vi.mock('@/components/game/ViewPing', () => ({
  ViewPing: hoisted.ViewPing,
}))
vi.mock('@/components/game/description/GameHeader', () => ({
  GameHeader: hoisted.GameHeader,
}))
vi.mock('@/components/common/site/Ad', () => ({
  Ad: hoisted.Ad,
}))
vi.mock('@/components/game/TabsNav', () => ({
  GameTabsNav: hoisted.GameTabsNav,
}))

describe('game route wrappers (unit)', () => {
  beforeEach(() => {
    hoisted.hasLocale.mockReset()
    hoisted.hasLocale.mockReturnValue(true)
    hoisted.notFound.mockClear()
    hoisted.get.mockReset()
    hoisted.requestFactory.mockClear()
    hoisted.createGenerateMetadata.mockClear()
    hoisted.getPreferredContent.mockClear()
  })

  it('renders game layout with header/tabs/ad when header exists', async () => {
    hoisted.get.mockResolvedValueOnce({ data: { id: 8, title: 'g8' } })

    const layoutModule = await import('../../../app/[locale]/(main)/game/[id]/layout')
    const element = await layoutModule.default({
      children: React.createElement('div', { id: 'game-child' }, 'game'),
      params: Promise.resolve({ locale: 'zh', id: '8' }),
    })
    const html = renderToStaticMarkup(element)

    expect(hoisted.get).toHaveBeenCalledWith('/game/8/header')
    expect(html).toContain('data-testid="view-ping"')
    expect(html).toContain('data-testid="game-header"')
    expect(html).toContain('data-id="8"')
    expect(html).toContain('data-testid="game-tabs"')
    expect(html).toContain('data-testid="ad"')
    expect(html).toContain('id="game-child"')
  })

  it('throws notFound for missing game header', async () => {
    hoisted.get.mockResolvedValueOnce({ data: null })

    const layoutModule = await import('../../../app/[locale]/(main)/game/[id]/layout')
    await expect(
      layoutModule.default({
        children: React.createElement('div'),
        params: Promise.resolve({ locale: 'en', id: '10' }),
      }),
    ).rejects.toThrow('NOT_FOUND')
    expect(hoisted.notFound).toHaveBeenCalledTimes(1)
  })

  it('exposes game layout metadata from preferred content', async () => {
    hoisted.get.mockResolvedValueOnce({ data: { id: 8 } })

    const layoutModule = await import('../../../app/[locale]/(main)/game/[id]/layout')
    await expect(
      layoutModule.generateMetadata({ params: Promise.resolve({ locale: 'zh', id: '8' }) }),
    ).resolves.toEqual({
      title: 'zh-title',
      description: 'line-1 line-2...',
      path: '/game/8',
      og: {
        title: 'zh-title',
        description: 'line-1 line-2...',
        image: 'zh-cover-url',
        aspect: '2:3',
      },
    })
    expect(hoisted.get).toHaveBeenCalledWith('/game/8')
  })
})
