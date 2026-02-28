import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const hasLocale = vi.fn(() => true)
  const notFound = vi.fn(() => {
    throw new Error('NOT_FOUND')
  })

  const NextIntlClientProvider = vi.fn(({ children }: { children: React.ReactNode }) =>
    React.createElement('section', { 'data-testid': 'intl-provider' }, children),
  )
  const ShionlibProvider = vi.fn(({ children }: { children: React.ReactNode }) =>
    React.createElement('section', { 'data-testid': 'shionlib-provider' }, children),
  )

  const UmamiProvider = vi.fn(() =>
    React.createElement('meta', { 'data-testid': 'umami-provider' }),
  )
  const OpenPanelProvider = vi.fn(() =>
    React.createElement('meta', { 'data-testid': 'openpanel-provider' }),
  )
  const RybbitProvider = vi.fn(() =>
    React.createElement('meta', { 'data-testid': 'rybbit-provider' }),
  )

  const Noto_Sans = vi.fn(() => ({ variable: '--font-latin' }))
  const Noto_Sans_SC = vi.fn(() => ({ variable: '--font-sc' }))
  const Noto_Sans_JP = vi.fn(() => ({ variable: '--font-jp' }))
  const Noto_Sans_Mono = vi.fn(() => ({ variable: '--font-mono' }))
  const Cinzel = vi.fn(() => ({ variable: '--font-cinzel' }))

  return {
    hasLocale,
    notFound,
    NextIntlClientProvider,
    ShionlibProvider,
    UmamiProvider,
    OpenPanelProvider,
    RybbitProvider,
    Noto_Sans,
    Noto_Sans_SC,
    Noto_Sans_JP,
    Noto_Sans_Mono,
    Cinzel,
  }
})

vi.mock('next-intl', () => ({
  hasLocale: hoisted.hasLocale,
  NextIntlClientProvider: hoisted.NextIntlClientProvider,
}))
vi.mock('next/navigation', () => ({
  notFound: hoisted.notFound,
}))
vi.mock('@/i18n/routing', () => ({
  routing: { locales: ['en', 'zh', 'ja'] },
}))
vi.mock('../../../app/[locale]/metadata', () => ({
  langMap: { en: 'en', zh: 'zh-Hans', ja: 'ja' },
  generateMetadata: vi.fn(async () => ({})),
}))
vi.mock('../../../app/[locale]/provider', () => ({
  __esModule: true,
  default: hoisted.ShionlibProvider,
}))
vi.mock('@/components/common/site/UmamiProvider', () => ({
  UmamiProvider: hoisted.UmamiProvider,
}))
vi.mock('@/components/common/site/OpenPanelProvider', () => ({
  OpenPanelProvider: hoisted.OpenPanelProvider,
}))
vi.mock('@/components/common/site/RybbitProvider', () => ({
  RybbitProvider: hoisted.RybbitProvider,
}))
vi.mock('next/font/google', () => ({
  Noto_Sans: hoisted.Noto_Sans,
  Noto_Sans_SC: hoisted.Noto_Sans_SC,
  Noto_Sans_JP: hoisted.Noto_Sans_JP,
  Noto_Sans_Mono: hoisted.Noto_Sans_Mono,
  Cinzel: hoisted.Cinzel,
}))
vi.mock('@/public/assets/styles/globals.css', () => ({}))

describe('app/[locale]/layout wrapper (unit)', () => {
  beforeEach(() => {
    hoisted.hasLocale.mockReset()
    hoisted.hasLocale.mockReturnValue(true)
    hoisted.notFound.mockClear()
  })

  it('renders html shell with i18n/app providers', async () => {
    const layoutModule = await import('../../../app/[locale]/layout')
    const element = await layoutModule.default({
      children: React.createElement('div', { id: 'root-child' }, 'root'),
      params: Promise.resolve({ locale: 'zh' }),
    })
    const html = renderToStaticMarkup(element)

    expect(html).toContain('lang="zh-Hans"')
    expect(html).toContain('--font-latin')
    expect(html).toContain('--font-sc')
    expect(html).toContain('--font-jp')
    expect(html).toContain('--font-mono')
    expect(html).toContain('--font-cinzel')
    expect(html).toContain('data-testid="umami-provider"')
    expect(html).toContain('data-testid="openpanel-provider"')
    expect(html).toContain('data-testid="rybbit-provider"')
    expect(html).toContain('data-testid="intl-provider"')
    expect(html).toContain('data-testid="shionlib-provider"')
    expect(html).toContain('id="root-child"')
  })

  it('throws notFound when locale is unsupported', async () => {
    hoisted.hasLocale.mockReturnValueOnce(false)

    const layoutModule = await import('../../../app/[locale]/layout')
    await expect(
      layoutModule.default({
        children: React.createElement('div'),
        params: Promise.resolve({ locale: 'xx' }),
      }),
    ).rejects.toThrow('NOT_FOUND')
    expect(hoisted.notFound).toHaveBeenCalledTimes(1)
  })
})
