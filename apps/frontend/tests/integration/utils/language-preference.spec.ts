import { afterEach, describe, expect, it, vi } from 'vitest'

const loadModule = async () => import('../../../utils/language-preference')

describe('utils/language-preference (integration)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('resolves locale from browser pathname before navigator fallback', async () => {
    vi.stubGlobal('window', { location: { pathname: '/zh/games' } })
    vi.stubGlobal('document', { cookie: '' })
    vi.stubGlobal('navigator', { language: 'ja-JP' })

    const { resolvePreferredLocale } = await loadModule()

    await expect(resolvePreferredLocale()).resolves.toBe('zh')
  })

  it('falls back to normalized navigator language in browser', async () => {
    vi.stubGlobal('window', { location: { pathname: '/' } })
    vi.stubGlobal('document', { cookie: '' })
    vi.stubGlobal('navigator', { language: 'ja-JP' })

    const { resolvePreferredLocale } = await loadModule()

    await expect(resolvePreferredLocale()).resolves.toBe('ja')
  })

  it('resolves locale from server cookie and accept-language header', async () => {
    vi.doMock('next/headers', () => ({
      cookies: vi
        .fn()
        .mockResolvedValueOnce({
          get: (key: string) => (key === 'shionlib_locale' ? { value: 'zh-CN' } : undefined),
        })
        .mockResolvedValueOnce({
          get: () => undefined,
        }),
      headers: vi.fn().mockResolvedValue({
        get: (key: string) => (key === 'accept-language' ? 'ja-JP,ja;q=0.9' : null),
      }),
    }))

    const { resolvePreferredLocale } = await loadModule()

    await expect(resolvePreferredLocale()).resolves.toBe('zh')
    await expect(resolvePreferredLocale()).resolves.toBe('ja')
  })

  it('falls back to default locale when server headers are unavailable', async () => {
    vi.doMock('next/headers', () => {
      throw new Error('headers unavailable')
    })

    const { resolvePreferredLocale, normalizeLocale } = await loadModule()

    expect(normalizeLocale('fr-FR')).toBe('en')
    expect(normalizeLocale('zh_CN')).toBe('zh')
    await expect(resolvePreferredLocale()).resolves.toBe('en')
  })
})
