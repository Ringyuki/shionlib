import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const Forget = vi.fn(() => React.createElement('section', { 'data-testid': 'forget-form' }, 'f'))
  const getTranslations = vi.fn()

  return {
    Forget,
    getTranslations,
  }
})

vi.mock('@/components/common/auth/password/forget/Forget', () => ({
  Forget: hoisted.Forget,
}))

vi.mock('next-intl/server', () => ({
  getTranslations: hoisted.getTranslations,
}))

describe('app/[locale]/(main)/user/password/forget/page (unit)', () => {
  beforeEach(() => {
    hoisted.getTranslations.mockReset()
  })

  it('renders forget password form', async () => {
    const pageModule = await import('../../../app/[locale]/(main)/user/password/forget/page')
    const html = renderToStaticMarkup(pageModule.default())

    expect(html).toContain('data-testid="forget-form"')
  })

  it('builds metadata from i18n title', async () => {
    hoisted.getTranslations.mockResolvedValue((key: string) => `forget-${key}`)

    const pageModule = await import('../../../app/[locale]/(main)/user/password/forget/page')
    const metadata = await pageModule.generateMetadata({
      params: Promise.resolve({ locale: 'ja' }),
    } as any)

    expect(metadata.title).toBe('forget-title')
    expect(metadata.alternates?.canonical).toBe('/ja/user/password/forget')
  })
})
