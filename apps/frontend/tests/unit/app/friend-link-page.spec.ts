import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const getTranslations = vi.fn()
  const Header = vi.fn(() => React.createElement('header', { 'data-testid': 'friend-header' }, 'h'))
  const Links = vi.fn(() => React.createElement('div', { 'data-testid': 'friend-links' }, 'l'))

  return {
    getTranslations,
    Header,
    Links,
  }
})

vi.mock('next-intl/server', () => ({
  getTranslations: hoisted.getTranslations,
}))

vi.mock('@/components/friend-link/Header', () => ({
  Header: hoisted.Header,
}))

vi.mock('@/components/friend-link/Links', () => ({
  Links: hoisted.Links,
}))

describe('app/[locale]/(main)/friend-link/page (unit)', () => {
  beforeEach(() => {
    hoisted.getTranslations.mockReset()
  })

  it('renders friend link page sections', async () => {
    const pageModule = await import('../../../app/[locale]/(main)/friend-link/page')
    const element = pageModule.default()

    const html = renderToStaticMarkup(element)
    expect(html).toContain('data-testid="friend-header"')
    expect(html).toContain('data-testid="friend-links"')
  })

  it('builds metadata from i18n messages', async () => {
    hoisted.getTranslations.mockResolvedValue((key: string) => `friend-${key}`)

    const pageModule = await import('../../../app/[locale]/(main)/friend-link/page')
    const metadata = await pageModule.generateMetadata({
      params: Promise.resolve({ locale: 'en' }),
    } as any)

    expect(metadata.title).toBe('friend-title')
    expect(metadata.description).toBe('friend-description')
    expect(metadata.alternates?.canonical).toBe('/en/friend-link')
  })
})
