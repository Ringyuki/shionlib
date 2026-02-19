import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const hasLocale = vi.fn(() => true)
  const notFound = vi.fn(() => {
    throw new Error('NOT_FOUND')
  })
  const getTranslations = vi.fn((ns: string) => Promise.resolve((key: string) => `${ns}.${key}`))
  const createGenerateMetadata = vi.fn((resolver: (args: any) => Promise<any> | any) => {
    return async ({ params }: { params: any | Promise<any> }) => {
      const awaited = params && typeof (params as any).then === 'function' ? await params : params
      return resolver(awaited ?? {})
    }
  })

  const Button = vi.fn(({ children }: { children: React.ReactNode }) =>
    React.createElement('button', { 'data-testid': 'btn' }, children),
  )
  const EditTabsNav = vi.fn(() =>
    React.createElement('section', { 'data-testid': 'game-edit-tabs' }, 'tabs'),
  )

  return {
    hasLocale,
    notFound,
    getTranslations,
    createGenerateMetadata,
    Button,
    EditTabsNav,
  }
})

vi.mock('next-intl', () => ({
  hasLocale: hoisted.hasLocale,
}))
vi.mock('next/navigation', () => ({
  notFound: hoisted.notFound,
}))
vi.mock('next-intl/server', () => ({
  getTranslations: hoisted.getTranslations,
}))
vi.mock('@/libs/seo/metadata', () => ({
  createGenerateMetadata: hoisted.createGenerateMetadata,
}))
vi.mock('@/i18n/routing', () => ({
  routing: { locales: ['en', 'zh', 'ja'] },
}))
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href }, children),
}))
vi.mock('@/components/shionui/Button', () => ({
  Button: hoisted.Button,
}))
vi.mock('lucide-react', () => ({
  Undo2: () => React.createElement('span', { 'data-testid': 'undo-icon' }, 'undo'),
}))
vi.mock('@/components/game/edit/EditTabsNav', () => ({
  EditTabsNav: hoisted.EditTabsNav,
}))

describe('edit route wrappers (unit)', () => {
  beforeEach(() => {
    hoisted.hasLocale.mockReset()
    hoisted.hasLocale.mockReturnValue(true)
    hoisted.notFound.mockClear()
    hoisted.getTranslations.mockClear()
    hoisted.createGenerateMetadata.mockClear()
  })

  it('renders character edit layout and back link', async () => {
    const layoutModule = await import('../../../app/[locale]/(main)/character/[id]/edit/layout')
    const element = await layoutModule.default({
      children: React.createElement('div', { id: 'character-edit-child' }, 'c'),
      params: Promise.resolve({ locale: 'zh', id: '11' }),
    })
    const html = renderToStaticMarkup(element)

    expect(hoisted.hasLocale).toHaveBeenCalledWith(['en', 'zh', 'ja'], 'zh')
    expect(html).toContain('Components.Character.Edit.EditLayout.edit')
    expect(html).toContain('href="/character/11"')
    expect(html).toContain('id="character-edit-child"')
  })

  it('throws notFound when developer edit locale is invalid', async () => {
    hoisted.hasLocale.mockReturnValueOnce(false)

    const layoutModule = await import('../../../app/[locale]/(main)/developer/[id]/edit/layout')
    await expect(
      layoutModule.default({
        children: React.createElement('div'),
        params: Promise.resolve({ locale: 'xx', id: '22' }),
      }),
    ).rejects.toThrow('NOT_FOUND')
    expect(hoisted.notFound).toHaveBeenCalledTimes(1)
  })

  it('renders game edit layout with tabs', async () => {
    const layoutModule = await import('../../../app/[locale]/(main)/game/[id]/edit/layout')
    const element = await layoutModule.default({
      children: React.createElement('div', { id: 'game-edit-child' }, 'g'),
      params: Promise.resolve({ locale: 'en', id: '66' }),
    })
    const html = renderToStaticMarkup(element)

    expect(html).toContain('Components.Game.Edit.EditLayout.edit')
    expect(html).toContain('href="/game/66"')
    expect(html).toContain('data-testid="game-edit-tabs"')
    expect(html).toContain('id="game-edit-child"')
  })

  it('exposes metadata generators for all edit layouts', async () => {
    const characterModule = await import('../../../app/[locale]/(main)/character/[id]/edit/layout')
    const developerModule = await import('../../../app/[locale]/(main)/developer/[id]/edit/layout')
    const gameModule = await import('../../../app/[locale]/(main)/game/[id]/edit/layout')

    await expect(
      characterModule.generateMetadata({ params: Promise.resolve({ locale: 'zh', id: '1' }) }),
    ).resolves.toEqual({
      title: 'Pages.Character.Edit.EditLayout.title',
      path: '/character/1/edit',
      robots: { index: false, follow: false },
    })
    await expect(
      developerModule.generateMetadata({ params: Promise.resolve({ locale: 'zh', id: '2' }) }),
    ).resolves.toEqual({
      title: 'Pages.Developer.Edit.EditLayout.title',
      path: '/developer/2/edit',
      robots: { index: false, follow: false },
    })
    await expect(
      gameModule.generateMetadata({ params: Promise.resolve({ locale: 'en', id: '3' }) }),
    ).resolves.toEqual({
      title: 'Pages.Game.Edit.EditLayout.title',
      path: '/game/3/edit',
      robots: { index: false, follow: false },
    })
  })
})
