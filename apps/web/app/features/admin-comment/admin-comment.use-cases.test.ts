import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { Schema } from '~/shared/api/types'
import type { CommentDetail, Filter } from './admin-comment'
import { changeComments, loadComments } from './admin-comment.use-cases'

const meta = (totalItems: number) => ({
  currentPage: 1,
  itemCount: 0,
  itemsPerPage: 20,
  totalItems,
  totalPages: 1,
})

const detail: CommentDetail = {
  id: 12,
  text: 'join the group',
  content: { type: 'doc', content: [] },
  parent_id: null,
  root_id: null,
  reply_count: 0,
  like_count: 0,
  creator: { id: 7, name: 'free_gal', email: 'f@example.test', avatar: null, is_sponsor: false },
  parent: null,
  game: { id: 4, title_jp: 'ゲーム', title_zh: '', title_en: '' },
  edited: false,
  status: 2,
  created: '2026-10-11T10:02:00.000Z',
  updated: '2026-10-11T10:02:00.000Z',
  moderations: null,
}

const author: Pick<Schema<'AdminUserDetailDTO'>, 'created'> = {
  created: '2026-10-08T00:00:00.000Z',
}

const filter: Filter = {
  status: 2,
  query: '',
  author: undefined,
  sort: 'newest',
  page: 1,
  opened: undefined,
}

const queries = (requests: Request[], path: string) =>
  requests
    .map(request => new URL(request.url))
    .filter(url => url.pathname === path)
    .map(url => Object.fromEntries(url.searchParams))

describe('loadComments', () => {
  it('asks for one page of what waits, newest first', async () => {
    const fake = fakeApi().on('get', '/admin/comments', { items: null, meta: meta(9) })
    const listing = await loadComments(fake.api, filter, 20)
    expect(listing).toMatchObject({ comments: [], total: 9, opened: undefined })
    expect(queries(fake.requests, '/admin/comments')).toEqual([
      { page: '1', pageSize: '20', sortBy: 'created', sortOrder: 'desc', status: '2' },
    ])
  })

  it('passes the search, the author and the order on, and leaves the status out for all', async () => {
    const fake = fakeApi().on('get', '/admin/comments', { items: null, meta: meta(0) })
    await loadComments(
      fake.api,
      { ...filter, status: 'ALL', query: 'group', author: 7, sort: 'oldest' },
      20,
    )
    expect(queries(fake.requests, '/admin/comments')).toEqual([
      {
        page: '1',
        pageSize: '20',
        sortBy: 'created',
        sortOrder: 'asc',
        search: 'group',
        creatorId: '7',
      },
    ])
  })

  it('opens a comment with what is known about its author', async () => {
    const fake = fakeApi()
      .on('get', '/admin/comments/{id}', detail)
      .on('get', '/admin/comments', { items: null, meta: meta(14) })
    const withUser = fake.on('get', '/admin/users/{id}', {
      ...author,
      id: 7,
      name: 'free_gal',
      email: 'f@example.test',
      avatar: null,
      cover: null,
      role: 1,
      status: 1,
      lang: 'zh',
      content_limit: 1,
      updated: author.created,
      last_login_at: null,
      two_factor_enabled: false,
      sponsor_expires_at: null,
      upload: {
        tier: 'new',
        approved: 0,
        trusted: false,
        frozen_until: null,
        stored: 0,
        stored_limit: 1,
        in_flight: 0,
        in_flight_limit: 1,
        max_file_size: 1,
      },
      violations: 0,
      counts: { comments: 14, resources: 0, favorites: 0, edits: 0 },
      latest_ban: null,
    })
    const listing = await loadComments(withUser.api, { ...filter, opened: 12 }, 20)
    expect(listing.opened).toEqual({
      detail,
      author: { joined: '2026-10-08T00:00:00.000Z', written: 14, blocked: 14 },
    })
    const asked = queries(fake.requests, '/admin/comments')
    expect(asked).toContainEqual({ page: '1', pageSize: '1', creatorId: '7' })
    expect(asked).toContainEqual({ page: '1', pageSize: '1', creatorId: '7', status: '3' })
  })

  it('opens nothing when the comment is gone', async () => {
    const fake = fakeApi()
      .on('get', '/admin/comments', { items: null, meta: meta(0) })
      .fail('get', '/admin/comments/{id}', 404, { code: 400101, message: 'gone' })
    await expect(loadComments(fake.api, { ...filter, opened: 12 }, 20)).resolves.toMatchObject({
      opened: undefined,
    })
  })
})

describe('changeComments', () => {
  it('names the category and the notice only when it blocks', async () => {
    const fake = fakeApi().on('patch', '/admin/comments/{id}/status', undefined)
    await changeComments(fake.api, {
      action: 'review',
      ids: [4, 5],
      status: 3,
      category: 'SPAM',
      reason: ' ad ',
      notify: false,
    })
    await changeComments(fake.api, {
      action: 'review',
      ids: [6],
      status: 1,
      category: 'SPAM',
      reason: 'ignored',
      notify: true,
    })
    expect(fake.requests.map(request => new URL(request.url).pathname)).toEqual([
      '/admin/comments/4/status',
      '/admin/comments/5/status',
      '/admin/comments/6/status',
    ])
    const [blocked, , approved] = await Promise.all(fake.requests.map(request => request.json()))
    expect(blocked).toEqual({ status: 3, top_category: 'SPAM', notify: false, reason: 'ad' })
    expect(approved).toEqual({ status: 1 })
  })

  it('sends a comment through moderation again', async () => {
    const fake = fakeApi().on('post', '/admin/comments/{id}/rescan', undefined)
    await changeComments(fake.api, { action: 'rescan', id: 4 })
    expect(new URL(fake.requests[0]?.url ?? '').pathname).toBe('/admin/comments/4/rescan')
  })
})
