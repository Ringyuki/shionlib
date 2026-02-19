import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const notFound = vi.fn(() => {
    throw new Error('NOT_FOUND')
  })

  const get = vi.fn()
  const requestFactory = vi.fn(() => ({ get }))

  const StatsCardGrid = vi.fn(({ data }: { data?: { totalUsers?: number } }) =>
    React.createElement(
      'section',
      { 'data-testid': 'admin-stats-grid', 'data-users': String(data?.totalUsers ?? 0) },
      'grid',
    ),
  )

  const TrendChart = vi.fn(({ data }: { data?: Array<{ date: string; totalGames: number }> }) =>
    React.createElement(
      'section',
      { 'data-testid': 'admin-trend-chart', 'data-count': String(data?.length ?? 0) },
      'chart',
    ),
  )

  const AdminCommentsClient = vi.fn(({ initialPage }: { initialPage: number }) =>
    React.createElement(
      'section',
      { 'data-testid': 'admin-comments', 'data-page': String(initialPage) },
      'c',
    ),
  )

  const AdminGamesClient = vi.fn(({ initialPage }: { initialPage: number }) =>
    React.createElement(
      'section',
      { 'data-testid': 'admin-games', 'data-page': String(initialPage) },
      'g',
    ),
  )

  const AdminReportsClient = vi.fn(({ initialPage }: { initialPage: number }) =>
    React.createElement(
      'section',
      { 'data-testid': 'admin-reports', 'data-page': String(initialPage) },
      'r',
    ),
  )

  const AdminMalwareScansClient = vi.fn(({ initialPage }: { initialPage: number }) =>
    React.createElement(
      'section',
      { 'data-testid': 'admin-malware', 'data-page': String(initialPage) },
      'm',
    ),
  )

  const AdminUsersClient = vi.fn(
    ({
      initialPage,
      currentRole,
      currentUserId,
    }: {
      initialPage: number
      currentRole: number
      currentUserId: number
    }) =>
      React.createElement(
        'section',
        {
          'data-testid': 'admin-users',
          'data-page': String(initialPage),
          'data-role': String(currentRole),
          'data-user-id': String(currentUserId),
        },
        'u',
      ),
  )

  const AdminGameScalarEditor = vi.fn(({ gameId }: { gameId: number }) =>
    React.createElement(
      'section',
      { 'data-testid': 'admin-game-editor', 'data-id': String(gameId) },
      'e',
    ),
  )

  return {
    notFound,
    get,
    requestFactory,
    StatsCardGrid,
    TrendChart,
    AdminCommentsClient,
    AdminGamesClient,
    AdminReportsClient,
    AdminMalwareScansClient,
    AdminUsersClient,
    AdminGameScalarEditor,
  }
})

vi.mock('next/navigation', () => ({
  notFound: hoisted.notFound,
}))

vi.mock('@/utils/request', () => ({
  shionlibRequest: hoisted.requestFactory,
}))

vi.mock('@/components/admin/dashboard/StatsCardGrid', () => ({
  StatsCardGrid: hoisted.StatsCardGrid,
}))
vi.mock('@/components/admin/dashboard/TrendChart', () => ({ TrendChart: hoisted.TrendChart }))
vi.mock('@/components/admin/comments/AdminCommentsClient', () => ({
  AdminCommentsClient: hoisted.AdminCommentsClient,
}))
vi.mock('@/components/admin/games/AdminGamesClient', () => ({
  AdminGamesClient: hoisted.AdminGamesClient,
}))
vi.mock('@/components/admin/reports/AdminReportsClient', () => ({
  AdminReportsClient: hoisted.AdminReportsClient,
}))
vi.mock('@/components/admin/malware-scans/AdminMalwareScansClient', () => ({
  AdminMalwareScansClient: hoisted.AdminMalwareScansClient,
}))
vi.mock('@/components/admin/users/AdminUsersClient', () => ({
  AdminUsersClient: hoisted.AdminUsersClient,
}))
vi.mock('@/components/admin/games/AdminGameScalarEditor', () => ({
  AdminGameScalarEditor: hoisted.AdminGameScalarEditor,
}))

describe('app/[locale]/(admin)/admin* pages (unit)', () => {
  beforeEach(() => {
    hoisted.notFound.mockClear()
    hoisted.get.mockReset()
    hoisted.requestFactory.mockClear()
  })

  it('renders admin dashboard with overview + trend requests', async () => {
    hoisted.get
      .mockResolvedValueOnce({ data: { totalUsers: 123 } })
      .mockResolvedValueOnce({ data: [{ date: '2026-01-01', totalGames: 7 }] })

    const pageModule = await import('../../../app/[locale]/(admin)/admin/page')
    const element = await pageModule.default()

    expect(hoisted.get).toHaveBeenNthCalledWith(1, '/admin/stats/overview')
    expect(hoisted.get).toHaveBeenNthCalledWith(2, '/admin/stats/trends', {
      params: { days: 30 },
    })

    const html = renderToStaticMarkup(element)
    expect(html).toContain('data-testid="admin-stats-grid"')
    expect(html).toContain('data-users="123"')
    expect(html).toContain('data-testid="admin-trend-chart"')
    expect(html).toContain('data-count="1"')
  })

  it('maps page query for admin list clients with fallback to 1', async () => {
    const commentsPage = await import('../../../app/[locale]/(admin)/admin/comments/page')
    const gamesPage = await import('../../../app/[locale]/(admin)/admin/games/page')
    const reportsPage = await import('../../../app/[locale]/(admin)/admin/reports/page')
    const malwarePage = await import('../../../app/[locale]/(admin)/admin/malware-scans/page')

    const c = await commentsPage.default({ searchParams: Promise.resolve({ page: '6' }) })
    const g = await gamesPage.default({ searchParams: Promise.resolve({ page: 'bad' }) as any })
    const r = await reportsPage.default({ searchParams: Promise.resolve({}) })
    const m = await malwarePage.default({ searchParams: Promise.resolve({ page: '3' }) })

    expect(renderToStaticMarkup(c)).toContain('data-testid="admin-comments"')
    expect(renderToStaticMarkup(c)).toContain('data-page="6"')
    expect(renderToStaticMarkup(g)).toContain('data-testid="admin-games"')
    expect(renderToStaticMarkup(g)).toContain('data-page="1"')
    expect(renderToStaticMarkup(r)).toContain('data-testid="admin-reports"')
    expect(renderToStaticMarkup(r)).toContain('data-page="1"')
    expect(renderToStaticMarkup(m)).toContain('data-testid="admin-malware"')
    expect(renderToStaticMarkup(m)).toContain('data-page="3"')
  })

  it('passes current user role/id to admin users client', async () => {
    hoisted.get.mockResolvedValue({ data: { id: 99, role: 3 } })

    const pageModule = await import('../../../app/[locale]/(admin)/admin/users/page')
    const element = await pageModule.default({ searchParams: Promise.resolve({ page: '5' }) })

    expect(hoisted.get).toHaveBeenCalledWith('/user/me')

    const html = renderToStaticMarkup(element)
    expect(html).toContain('data-testid="admin-users"')
    expect(html).toContain('data-page="5"')
    expect(html).toContain('data-role="3"')
    expect(html).toContain('data-user-id="99"')
  })

  it('validates admin game edit id and data existence', async () => {
    const pageModule = await import('../../../app/[locale]/(admin)/admin/games/[id]/edit/page')

    await expect(pageModule.default({ params: Promise.resolve({ id: 'x' }) })).rejects.toThrow(
      'NOT_FOUND',
    )

    hoisted.get.mockResolvedValueOnce({ data: null })
    await expect(pageModule.default({ params: Promise.resolve({ id: '2' }) })).rejects.toThrow(
      'NOT_FOUND',
    )

    hoisted.get.mockResolvedValueOnce({ data: { name: 'Game 2' } })
    const element = await pageModule.default({ params: Promise.resolve({ id: '2' }) })

    expect(hoisted.get).toHaveBeenLastCalledWith('/admin/content/games/2/edit/scalar')
    const html = renderToStaticMarkup(element)
    expect(html).toContain('data-testid="admin-game-editor"')
    expect(html).toContain('data-id="2"')
  })
})
