import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const hasLocale = vi.fn(() => true)
  const notFound = vi.fn(() => {
    throw new Error('NOT_FOUND')
  })
  const redirect = vi.fn((href: string) => {
    throw new Error(`REDIRECT:${href}`)
  })
  const get = vi.fn()
  const requestFactory = vi.fn(() => ({ get }))
  const getTranslations = vi.fn((ns: string) => Promise.resolve((key: string) => `${ns}.${key}`))
  const createGenerateMetadata = vi.fn((resolver: (args: any) => Promise<any> | any) => {
    return async ({ params }: { params: any | Promise<any> }) => {
      const awaited = params && typeof (params as any).then === 'function' ? await params : params
      return resolver(awaited ?? {})
    }
  })

  const AdminSidebar = vi.fn(() =>
    React.createElement('aside', { 'data-testid': 'admin-sidebar' }, 'admin'),
  )
  const SidebarProvider = vi.fn(({ children }: { children: React.ReactNode }) =>
    React.createElement('section', { 'data-testid': 'sidebar-provider' }, children),
  )
  const SidebarInset = vi.fn(
    ({ children, className }: { children: React.ReactNode; className?: string }) =>
      React.createElement(
        'section',
        { 'data-testid': 'sidebar-inset', 'data-class': className ?? '' },
        children,
      ),
  )
  const SidebarTrigger = vi.fn(() =>
    React.createElement('button', { 'data-testid': 'sidebar-trigger' }, 'toggle'),
  )

  const UserProfile = vi.fn(({ user }: { user: { id: number } }) =>
    React.createElement('section', { 'data-testid': 'user-profile', 'data-id': String(user.id) }),
  )
  const FavoriteSidebar = vi.fn(
    ({
      userId,
      currentUser,
      favorites,
    }: {
      userId: string
      currentUser: { id: number } | null
      favorites: unknown[]
    }) =>
      React.createElement('section', {
        'data-testid': 'favorite-sidebar',
        'data-user-id': userId,
        'data-current-id': String(currentUser?.id ?? 0),
        'data-fcount': String(favorites.length),
      }),
  )
  const HomeTabsNav = vi.fn(({ user }: { user: { id: number } }) =>
    React.createElement('section', { 'data-testid': 'home-tabs', 'data-id': String(user.id) }),
  )
  const UserSettingsTabsNav = vi.fn(() =>
    React.createElement('section', { 'data-testid': 'user-settings-tabs' }),
  )

  return {
    hasLocale,
    notFound,
    redirect,
    get,
    requestFactory,
    getTranslations,
    createGenerateMetadata,
    AdminSidebar,
    SidebarProvider,
    SidebarInset,
    SidebarTrigger,
    UserProfile,
    FavoriteSidebar,
    HomeTabsNav,
    UserSettingsTabsNav,
  }
})

vi.mock('next-intl', () => ({
  hasLocale: hoisted.hasLocale,
}))
vi.mock('next/navigation', () => ({
  notFound: hoisted.notFound,
  redirect: hoisted.redirect,
}))
vi.mock('next-intl/server', () => ({
  getTranslations: hoisted.getTranslations,
}))
vi.mock('@/libs/seo/metadata', () => ({
  createGenerateMetadata: hoisted.createGenerateMetadata,
}))
vi.mock('@/utils/request', () => ({
  shionlibRequest: hoisted.requestFactory,
}))
vi.mock('@/i18n/routing', () => ({
  routing: { locales: ['en', 'zh', 'ja'] },
}))

vi.mock('@/components/admin/layout/AdminSidebar', () => ({
  AdminSidebar: hoisted.AdminSidebar,
}))
vi.mock('@/components/shionui/Sidebar', () => ({
  SidebarProvider: hoisted.SidebarProvider,
  SidebarInset: hoisted.SidebarInset,
  SidebarTrigger: hoisted.SidebarTrigger,
}))
vi.mock('@/components/user/home/profile/UserProfile', () => ({
  UserProfile: hoisted.UserProfile,
}))
vi.mock('@/components/user/home/favorites/FavoriteSidebar', () => ({
  FavoriteSidebar: hoisted.FavoriteSidebar,
}))
vi.mock('@/components/user/home/HomeTabsNav', () => ({
  HomeTabsNav: hoisted.HomeTabsNav,
}))
vi.mock('@/components/user/settings/TabsNav', () => ({
  UserSettingsTabsNav: hoisted.UserSettingsTabsNav,
}))

describe('admin/user route wrappers (unit)', () => {
  beforeEach(() => {
    hoisted.hasLocale.mockReset()
    hoisted.hasLocale.mockReturnValue(true)
    hoisted.notFound.mockClear()
    hoisted.redirect.mockClear()
    hoisted.get.mockReset()
    hoisted.requestFactory.mockClear()
    hoisted.getTranslations.mockClear()
    hoisted.createGenerateMetadata.mockClear()
  })

  it('redirects non-admin users away from admin layout', async () => {
    hoisted.get.mockResolvedValueOnce({ data: { id: 1, role: 1 } })

    const layoutModule = await import('../../../app/[locale]/(admin)/admin/layout')
    await expect(
      layoutModule.default({
        children: React.createElement('div'),
        params: Promise.resolve({ locale: 'zh' }),
      }),
    ).rejects.toThrow('REDIRECT:/zh')
    expect(hoisted.redirect).toHaveBeenCalledWith('/zh')
  })

  it('renders admin layout shell for admin role', async () => {
    hoisted.get.mockResolvedValueOnce({ data: { id: 2, role: 2 } })

    const layoutModule = await import('../../../app/[locale]/(admin)/admin/layout')
    const element = await layoutModule.default({
      children: React.createElement('div', { id: 'admin-child' }, 'admin'),
      params: Promise.resolve({ locale: 'en' }),
    })
    const html = renderToStaticMarkup(element)

    expect(hoisted.requestFactory).toHaveBeenCalledWith({ forceNotThrowError: true })
    expect(hoisted.get).toHaveBeenCalledWith('/user/me')
    expect(html).toContain('data-testid="sidebar-provider"')
    expect(html).toContain('data-testid="admin-sidebar"')
    expect(html).toContain('data-testid="sidebar-inset"')
    expect(html).toContain('data-testid="sidebar-trigger"')
    expect(html).toContain('id="admin-child"')
  })

  it('renders user profile layout with profile/favorites/tabs', async () => {
    hoisted.get
      .mockResolvedValueOnce({ data: { id: 9, name: 'user-9' } })
      .mockResolvedValueOnce({ data: { id: 88, name: 'me' } })
      .mockResolvedValueOnce({ data: [{ id: 1 }, { id: 2 }] })

    const layoutModule = await import('../../../app/[locale]/(main)/user/[id]/layout')
    const element = await layoutModule.default({
      children: React.createElement('div', { id: 'user-layout-child' }, 'user'),
      params: Promise.resolve({ locale: 'ja', id: '9' }),
    })
    const html = renderToStaticMarkup(element)

    expect(hoisted.hasLocale).toHaveBeenCalledWith(['en', 'zh', 'ja'], 'ja')
    expect(hoisted.get).toHaveBeenNthCalledWith(1, '/user/9')
    expect(hoisted.get).toHaveBeenNthCalledWith(2, '/user/me')
    expect(hoisted.get).toHaveBeenNthCalledWith(3, '/favorites', { params: { user_id: '9' } })
    expect(html).toContain('data-testid="user-profile"')
    expect(html).toContain('data-id="9"')
    expect(html).toContain('data-testid="favorite-sidebar"')
    expect(html).toContain('data-user-id="9"')
    expect(html).toContain('data-current-id="88"')
    expect(html).toContain('data-fcount="2"')
    expect(html).toContain('data-testid="home-tabs"')
    expect(html).toContain('id="user-layout-child"')
  })

  it('throws notFound when user profile data is missing', async () => {
    hoisted.get
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { id: 88 } })
      .mockResolvedValueOnce({ data: [] })

    const layoutModule = await import('../../../app/[locale]/(main)/user/[id]/layout')
    await expect(
      layoutModule.default({
        children: React.createElement('div'),
        params: Promise.resolve({ locale: 'zh', id: '12' }),
      }),
    ).rejects.toThrow('NOT_FOUND')
    expect(hoisted.notFound).toHaveBeenCalledTimes(1)
  })

  it('renders user settings layout and metadata', async () => {
    const layoutModule = await import('../../../app/[locale]/(main)/user/settings/layout')
    const element = await layoutModule.default({
      children: React.createElement('div', { id: 'settings-child' }, 'settings'),
      params: Promise.resolve({ locale: 'en' }),
    })
    const html = renderToStaticMarkup(element)

    expect(html).toContain('Pages.User.Settings.title')
    expect(html).toContain('Pages.User.Settings.description')
    expect(html).toContain('data-testid="user-settings-tabs"')
    expect(html).toContain('id="settings-child"')
    await expect(
      layoutModule.generateMetadata({ params: Promise.resolve({ locale: 'en' }) }),
    ).resolves.toEqual({
      title: 'Pages.User.Settings.title',
      path: '/user/settings',
      robots: { index: false, follow: false },
    })
  })
})
