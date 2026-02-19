import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const get = vi.fn()
  const requestFactory = vi.fn(() => ({ get }))

  const UserSettings = vi.fn(({ user }: { user: { id: number } }) =>
    React.createElement(
      'section',
      { 'data-testid': 'user-settings', 'data-id': String(user.id) },
      'u',
    ),
  )
  const SiteSettings = vi.fn(({ user }: { user: { id: number } }) =>
    React.createElement(
      'section',
      { 'data-testid': 'site-settings', 'data-id': String(user.id) },
      's',
    ),
  )
  const LoginRequired = vi.fn(() =>
    React.createElement('section', { 'data-testid': 'login-required' }, 'login'),
  )
  const DownloadSettings = vi.fn(() =>
    React.createElement('section', { 'data-testid': 'download-settings' }, 'download'),
  )

  return {
    get,
    requestFactory,
    UserSettings,
    SiteSettings,
    LoginRequired,
    DownloadSettings,
  }
})

vi.mock('@/utils/request', () => ({
  shionlibRequest: hoisted.requestFactory,
}))

vi.mock('@/components/user/settings/UserSettings', () => ({
  UserSettings: hoisted.UserSettings,
}))
vi.mock('@/components/user/settings/SiteSettings', () => ({
  SiteSettings: hoisted.SiteSettings,
}))
vi.mock('@/components/user/settings/LoginRequired', () => ({
  LoginRequired: hoisted.LoginRequired,
}))
vi.mock('@/components/user/settings/DownloadSettings', () => ({
  DownloadSettings: hoisted.DownloadSettings,
}))

describe('app/[locale]/(main)/user/settings/* pages (unit)', () => {
  beforeEach(() => {
    hoisted.get.mockReset()
    hoisted.requestFactory.mockClear()
  })

  it('renders LoginRequired when personal settings user is not logged in', async () => {
    hoisted.get.mockResolvedValue({ data: null })

    const pageModule = await import('../../../app/[locale]/(main)/user/settings/personal/page')
    const element = await pageModule.default()

    expect(hoisted.get).toHaveBeenCalledWith('/user/me')
    const html = renderToStaticMarkup(element)
    expect(html).toContain('data-testid="login-required"')
  })

  it('renders user settings when personal settings has user data', async () => {
    hoisted.get.mockResolvedValue({ data: { id: 7 } })

    const pageModule = await import('../../../app/[locale]/(main)/user/settings/personal/page')
    const element = await pageModule.default()

    const html = renderToStaticMarkup(element)
    expect(html).toContain('data-testid="user-settings"')
    expect(html).toContain('data-id="7"')
  })

  it('renders site settings when user exists', async () => {
    hoisted.get.mockResolvedValue({ data: { id: 8 } })

    const pageModule = await import('../../../app/[locale]/(main)/user/settings/site/page')
    const element = await pageModule.default()

    expect(hoisted.get).toHaveBeenCalledWith('/user/me')
    const html = renderToStaticMarkup(element)
    expect(html).toContain('data-testid="site-settings"')
    expect(html).toContain('data-id="8"')
  })

  it('renders download settings page', async () => {
    const pageModule = await import('../../../app/[locale]/(main)/user/settings/download/page')
    const element = await pageModule.default()

    const html = renderToStaticMarkup(element)
    expect(html).toContain('data-testid="download-settings"')
  })
})
