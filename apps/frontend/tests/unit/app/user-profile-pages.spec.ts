import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const get = vi.fn()
  const requestFactory = vi.fn(() => ({ get }))
  const redirect = vi.fn((href: string) => {
    throw new Error(`REDIRECT:${href}`)
  })

  const UploadsContent = vi.fn(({ resources }: { resources: unknown[] }) =>
    React.createElement(
      'section',
      { 'data-testid': 'user-uploads', 'data-count': String(resources.length) },
      'u',
    ),
  )
  const CommentContent = vi.fn(
    ({ comments, is_current_user }: { comments: unknown[]; is_current_user: boolean }) =>
      React.createElement(
        'section',
        {
          'data-testid': 'user-comments',
          'data-count': String(comments.length),
          'data-self': String(is_current_user),
        },
        'c',
      ),
  )
  const EditsContent = vi.fn(({ edits }: { edits: unknown[] }) =>
    React.createElement(
      'section',
      { 'data-testid': 'user-edits', 'data-count': String(edits.length) },
      'e',
    ),
  )
  const FavoriteItemsHeader = vi.fn(
    ({
      favorite,
      currentUser,
      userId,
    }: {
      favorite: { id: number }
      currentUser: any
      userId: string
    }) =>
      React.createElement(
        'section',
        {
          'data-testid': 'user-fav-header',
          'data-folder': String(favorite.id),
          'data-current-user': String(currentUser?.id ?? 0),
          'data-user-id': userId,
        },
        'h',
      ),
  )
  const FavoriteContent = vi.fn(({ favorites }: { favorites: unknown[] }) =>
    React.createElement(
      'section',
      { 'data-testid': 'user-fav-content', 'data-count': String(favorites.length) },
      'f',
    ),
  )
  const Pagination = vi.fn(
    ({
      currentPage,
      totalPages,
      extraQuery,
    }: {
      currentPage: number
      totalPages: number
      extraQuery?: { folder?: number }
    }) =>
      React.createElement(
        'section',
        {
          'data-testid': 'pagination',
          'data-current': String(currentPage),
          'data-total': String(totalPages),
          'data-folder': String(extraQuery?.folder ?? ''),
        },
        'p',
      ),
  )
  const Empty = vi.fn(() => React.createElement('section', { 'data-testid': 'empty' }, 'empty'))

  return {
    get,
    requestFactory,
    redirect,
    UploadsContent,
    CommentContent,
    EditsContent,
    FavoriteItemsHeader,
    FavoriteContent,
    Pagination,
    Empty,
  }
})

vi.mock('next/navigation', () => ({
  redirect: hoisted.redirect,
}))

vi.mock('@/utils/request', () => ({
  shionlibRequest: hoisted.requestFactory,
}))

vi.mock('@/components/user/home/uploads/UploadsContent', () => ({
  UploadsContent: hoisted.UploadsContent,
}))
vi.mock('@/components/user/home/comments/CommentContent', () => ({
  CommentContent: hoisted.CommentContent,
}))
vi.mock('@/components/user/home/edits/EditsContent', () => ({
  EditsContent: hoisted.EditsContent,
}))
vi.mock('@/components/user/home/favorites/FavoriteItemsHeader', () => ({
  FavoriteItemsHeader: hoisted.FavoriteItemsHeader,
}))
vi.mock('@/components/user/home/favorites/FavoriteContent', () => ({
  FavoriteContent: hoisted.FavoriteContent,
}))
vi.mock('@/components/common/content/Pagination', () => ({
  Pagination: hoisted.Pagination,
}))
vi.mock('@/components/common/content/Empty', () => ({
  Empty: hoisted.Empty,
}))

describe('app/[locale]/(main)/user/[id]* pages (unit)', () => {
  beforeEach(() => {
    hoisted.get.mockReset()
    hoisted.requestFactory.mockClear()
    hoisted.redirect.mockClear()
  })

  it('redirects user root tab to uploads', async () => {
    const pageModule = await import('../../../app/[locale]/(main)/user/[id]/page')

    await expect(pageModule.default({ params: Promise.resolve({ id: '17' }) })).rejects.toThrow(
      'REDIRECT:/user/17/uploads',
    )
    expect(hoisted.redirect).toHaveBeenCalledWith('/user/17/uploads')
  })

  it('renders uploads page with resource data and pagination', async () => {
    hoisted.get.mockResolvedValue({
      data: {
        items: [{ id: 1 }, { id: 2 }],
        meta: {
          currentPage: 4,
          totalPages: 8,
          content_limit: { image: 1, video: 1 },
          is_current_user: true,
          has_on_going_session: false,
        },
      },
    })

    const pageModule = await import('../../../app/[locale]/(main)/user/[id]/uploads/page')
    const element = await pageModule.default({
      params: Promise.resolve({ id: '3' }),
      searchParams: Promise.resolve({ page: '4' }),
    })

    expect(hoisted.get).toHaveBeenCalledWith('/user/datas/3/game-resources', {
      params: { page: '4' },
    })

    const html = renderToStaticMarkup(element)
    expect(html).toContain('data-testid="user-uploads"')
    expect(html).toContain('data-count="2"')
    expect(html).toContain('data-testid="pagination"')
    expect(html).toContain('data-current="4"')
    expect(html).toContain('data-total="8"')
  })

  it('renders empty state on comments page when list is empty', async () => {
    hoisted.get.mockResolvedValue({
      data: {
        items: [],
        meta: {
          currentPage: 1,
          totalPages: 1,
          is_current_user: false,
        },
      },
    })

    const pageModule = await import('../../../app/[locale]/(main)/user/[id]/comments/page')
    const element = await pageModule.default({
      params: Promise.resolve({ id: '2' }),
      searchParams: Promise.resolve({} as any),
    })

    expect(hoisted.get).toHaveBeenCalledWith('/user/datas/2/comments', {
      params: { page: '1' },
    })
    expect(renderToStaticMarkup(element)).toContain('data-testid="empty"')
  })

  it('renders edits page list with page fallback to 1', async () => {
    hoisted.get.mockResolvedValue({
      data: {
        items: [{ id: 10 }],
        meta: {
          currentPage: 1,
          totalPages: 6,
        },
      },
    })

    const pageModule = await import('../../../app/[locale]/(main)/user/[id]/edits/page')
    const element = await pageModule.default({
      params: Promise.resolve({ id: '2' }),
      searchParams: Promise.resolve({} as any),
    })

    expect(hoisted.get).toHaveBeenCalledWith('/user/datas/2/edit-records', {
      params: { page: '1' },
    })

    const html = renderToStaticMarkup(element)
    expect(html).toContain('data-testid="user-edits"')
    expect(html).toContain('data-count="1"')
    expect(html).toContain('data-testid="pagination"')
  })

  it('renders favorites empty state when user has no folders', async () => {
    hoisted.get.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: { id: 66 } })

    const pageModule = await import('../../../app/[locale]/(main)/user/[id]/favorites/page')
    const element = await pageModule.default({
      params: Promise.resolve({ id: '5' }),
      searchParams: Promise.resolve({ page: '1' }),
    })

    expect(hoisted.get).toHaveBeenNthCalledWith(1, '/favorites', {
      params: { user_id: '5' },
    })
    expect(hoisted.get).toHaveBeenNthCalledWith(2, '/user/me')
    expect(renderToStaticMarkup(element)).toContain('data-testid="empty"')
  })

  it('renders favorites content using selected folder query', async () => {
    hoisted.get
      .mockResolvedValueOnce({
        data: [
          { id: 1, default: true, name: 'Default' },
          { id: 9, default: false, name: 'Extra' },
        ],
      })
      .mockResolvedValueOnce({ data: { id: 88 } })
      .mockResolvedValueOnce({
        data: {
          items: [{ id: 100 }, { id: 101 }],
          meta: {
            currentPage: 2,
            totalPages: 3,
            content_limit: { image: 3 },
          },
        },
      })

    const pageModule = await import('../../../app/[locale]/(main)/user/[id]/favorites/page')
    const element = await pageModule.default({
      params: Promise.resolve({ id: '5' }),
      searchParams: Promise.resolve({ page: '2', folder: '9' }),
    })

    expect(hoisted.requestFactory).toHaveBeenNthCalledWith(1)
    expect(hoisted.requestFactory).toHaveBeenNthCalledWith(2, { forceNotThrowError: true })
    expect(hoisted.requestFactory).toHaveBeenNthCalledWith(3)
    expect(hoisted.get).toHaveBeenNthCalledWith(1, '/favorites', {
      params: { user_id: '5' },
    })
    expect(hoisted.get).toHaveBeenNthCalledWith(2, '/user/me')
    expect(hoisted.get).toHaveBeenNthCalledWith(3, '/favorites/9/items', {
      params: { page: '2' },
    })

    const html = renderToStaticMarkup(element)
    expect(html).toContain('data-testid="user-fav-header"')
    expect(html).toContain('data-folder="9"')
    expect(html).toContain('data-current-user="88"')
    expect(html).toContain('data-user-id="5"')
    expect(html).toContain('data-testid="user-fav-content"')
    expect(html).toContain('data-count="2"')
    expect(html).toContain('data-testid="pagination"')
    expect(html).toContain('data-current="2"')
    expect(html).toContain('data-total="3"')
    expect(html).toContain('data-folder="9"')
  })
})
