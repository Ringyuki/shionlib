import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const getDirectoryTree = vi.fn(() => [{ key: 'intro' }])
  const useTranslations = vi.fn(() => (key: string) => `i18n.${key}`)

  const TopBar = vi.fn(() => React.createElement('header', { 'data-testid': 'topbar' }, 'top'))
  const Footer = vi.fn(() => React.createElement('footer', { 'data-testid': 'footer' }, 'foot'))
  const GlobalDialogs = vi.fn(() =>
    React.createElement('section', { 'data-testid': 'global-dialogs' }, 'dialogs'),
  )
  const Message = vi.fn(({ children }: { children: React.ReactNode }) =>
    React.createElement('section', { 'data-testid': 'message-layout' }, children),
  )
  const DocsSideBar = vi.fn(({ tree }: { tree: unknown[] }) =>
    React.createElement('aside', {
      'data-testid': 'docs-sidebar',
      'data-size': String(tree.length),
    }),
  )
  const ErrorView = vi.fn(
    ({
      title,
      details,
      showReset,
      onReset,
    }: {
      title?: string
      details?: string
      showReset?: boolean
      onReset?: () => void
    }) =>
      React.createElement('section', {
        'data-testid': 'error-view',
        'data-title': title ?? '',
        'data-details': details ?? '',
        'data-show-reset': String(Boolean(showReset)),
        'data-has-reset': String(typeof onReset === 'function'),
      }),
  )

  return {
    getDirectoryTree,
    useTranslations,
    TopBar,
    Footer,
    GlobalDialogs,
    Message,
    DocsSideBar,
    ErrorView,
  }
})

vi.mock('@/libs/docs/directoryTree', () => ({
  getDirectoryTree: hoisted.getDirectoryTree,
}))
vi.mock('next-intl', () => ({
  useTranslations: hoisted.useTranslations,
}))
vi.mock('@/components/common/top-bar/TopBar', () => ({
  __esModule: true,
  default: hoisted.TopBar,
}))
vi.mock('@/components/common/footer/Footer', () => ({
  ShionlibFooter: hoisted.Footer,
}))
vi.mock('@/components/common/user/GlobalDialogs', () => ({
  GlobalDialogs: hoisted.GlobalDialogs,
}))
vi.mock('@/components/message/Message', () => ({
  Message: hoisted.Message,
}))
vi.mock('@/components/docs/sidebar/SideBar', () => ({
  DocsSideBar: hoisted.DocsSideBar,
}))
vi.mock('@/components/common/error/ErrorView', () => ({
  __esModule: true,
  default: hoisted.ErrorView,
}))

describe('basic route wrappers (unit)', () => {
  it('renders main layout shell components', async () => {
    const layoutModule = await import('../../../app/[locale]/(main)/layout')
    const element = layoutModule.default({
      children: React.createElement('div', { id: 'child' }, 'content'),
    })
    const html = renderToStaticMarkup(element)

    expect(html).toContain('data-testid="topbar"')
    expect(html).toContain('data-testid="footer"')
    expect(html).toContain('data-testid="global-dialogs"')
    expect(html).toContain('id="child"')
  })

  it('renders docs layout with locale tree', async () => {
    hoisted.getDirectoryTree.mockReturnValueOnce([{ key: 'a' }, { key: 'b' }])

    const layoutModule = await import('../../../app/[locale]/(main)/docs/layout')
    const element = await layoutModule.default({
      children: React.createElement('article', { id: 'doc-child' }, 'doc'),
      params: Promise.resolve({ locale: 'zh' }),
    })
    const html = renderToStaticMarkup(element)

    expect(hoisted.getDirectoryTree).toHaveBeenCalledWith('zh')
    expect(html).toContain('data-testid="docs-sidebar"')
    expect(html).toContain('data-size="2"')
    expect(html).toContain('id="doc-child"')
  })

  it('renders message layout and keeps children', async () => {
    const layoutModule = await import('../../../app/[locale]/(main)/message/layout')
    const element = await layoutModule.default({
      children: React.createElement('div', { id: 'msg-child' }, 'msg'),
    })
    const html = renderToStaticMarkup(element)

    expect(html).toContain('data-testid="message-layout"')
    expect(html).toContain('id="msg-child"')
  })

  it('renders error wrapper with reset action', async () => {
    const pageModule = await import('../../../app/[locale]/(main)/error')
    const element = pageModule.default({
      error: new Error('boom'),
      reset: () => undefined,
    })
    const html = renderToStaticMarkup(element)

    expect(html).toContain('data-testid="error-view"')
    expect(html).toContain('data-details="boom"')
    expect(html).toContain('data-show-reset="true"')
    expect(html).toContain('data-has-reset="true"')
  })

  it('renders not-found page with translated title/details', async () => {
    const pageModule = await import('../../../app/[locale]/(main)/not-found')
    const element = pageModule.default()
    const html = renderToStaticMarkup(element)

    expect(hoisted.useTranslations).toHaveBeenCalledWith('Pages.NotFound')
    expect(html).toContain('data-testid="error-view"')
    expect(html).toContain('data-title="i18n.title"')
    expect(html).toContain('data-details="i18n.details"')
  })
})
