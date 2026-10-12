import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { Filter, UserDetail } from './admin-user'
import { changeUser, loadUser, loadUsers } from './admin-user.use-cases'

const meta = (totalItems: number) => ({
  currentPage: 1,
  itemCount: 0,
  itemsPerPage: 20,
  totalItems,
  totalPages: 1,
})

const detail: UserDetail = {
  id: 7,
  name: 'kotori',
  email: 'kotori@example.test',
  avatar: null,
  cover: null,
  role: 1,
  status: 1,
  lang: 'zh',
  content_limit: 2,
  created: '2026-02-14T00:00:00.000Z',
  updated: '2026-02-14T00:00:00.000Z',
  last_login_at: null,
  two_factor_enabled: false,
  sponsor_expires_at: null,
  upload: {
    tier: 'regular',
    approved: 12,
    trusted: false,
    frozen_until: null,
    stored: 0,
    stored_limit: 300,
    in_flight: 0,
    in_flight_limit: 30,
    max_file_size: 30,
  },
  violations: 0,
  counts: { comments: 9, resources: 12, favorites: 48, edits: 0 },
  latest_ban: null,
}

const filter: Filter = {
  query: '',
  role: undefined,
  status: undefined,
  sort: 'last_login_at',
  page: 1,
}

const urls = (requests: Request[]) => requests.map(request => new URL(request.url))

describe('loadUsers', () => {
  it('asks for one page in the chosen order', async () => {
    const fake = fakeApi().on('get', '/admin/users', { items: null, meta: meta(8546) })
    const listing = await loadUsers(fake.api, filter, 20)
    expect(listing).toMatchObject({ users: [], total: 8546 })
    expect(Object.fromEntries(urls(fake.requests)[0]?.searchParams ?? [])).toEqual({
      page: '1',
      pageSize: '20',
      sortBy: 'last_login_at',
      sortOrder: 'desc',
    })
  })

  it('passes the search and the filters on', async () => {
    const fake = fakeApi().on('get', '/admin/users', { items: null, meta: meta(1) })
    await loadUsers(fake.api, { query: 'kotori', role: 2, status: 2, sort: 'name', page: 3 }, 20)
    expect(Object.fromEntries(urls(fake.requests)[0]?.searchParams ?? [])).toEqual({
      page: '3',
      pageSize: '20',
      sortBy: 'name',
      sortOrder: 'asc',
      search: 'kotori',
      role: '2',
      status: '2',
    })
  })
})

describe('loadUser', () => {
  it('reads the user with live sessions, the tiers and the related counts', async () => {
    const fake = fakeApi()
      .on('get', '/admin/users/{id}', detail)
      .on('get', '/admin/users/{id}/sessions', { items: null, meta: meta(3) })
      .on('get', '/admin/upload-tiers', { tiers: null, in_flight_limit: 30 })
      .on('get', '/admin/content/download-resource-reports', { items: null, meta: meta(4) })
      .on('get', '/admin/content/malware-scan-cases', { items: null, meta: meta(1) })
    const opened = await loadUser(fake.api, 7)
    expect(opened).toMatchObject({
      detail: { name: 'kotori' },
      sessions: [],
      liveSessions: 3,
      records: { reportsFiled: 4, reportsAgainst: 4, heldFiles: 1 },
    })
    const asked = urls(fake.requests)
    expect(
      asked.find(url => url.pathname === '/admin/users/7/sessions')?.searchParams.get('live'),
    ).toBe('true')
    const reports = asked.filter(url => url.pathname === '/admin/content/download-resource-reports')
    expect(reports.map(url => url.searchParams.get('reporter_id'))).toContain('7')
    expect(reports.map(url => url.searchParams.get('reported_user_id'))).toContain('7')
    const cases = asked.find(url => url.pathname === '/admin/content/malware-scan-cases')
    expect(cases?.searchParams.get('uploader_id')).toBe('7')
    expect(cases?.searchParams.get('status')).toBe('PENDING')
  })

  it('surfaces a user that does not exist', async () => {
    const fake = fakeApi().fail('get', '/admin/users/{id}', 404, { code: 300101, message: 'gone' })
    await expect(loadUser(fake.api, 7)).rejects.toMatchObject({ status: 404 })
  })
})

describe('changeUser', () => {
  it('sends each change to its endpoint', async () => {
    const fake = fakeApi()
      .on('patch', '/admin/users/{id}/profile', { id: 7, name: 'kotori', email: 'k@example.test' })
      .on('post', '/admin/users/{id}/ban', undefined)
      .on('post', '/admin/users/{id}/unban', undefined)
      .on('post', '/admin/users/{id}/reset-password', undefined)
      .on('post', '/admin/users/{id}/force-logout', undefined)
      .on('patch', '/admin/users/{id}/upload-trust', undefined)
      .on('patch', '/admin/users/{id}/role', undefined)
      .on('patch', '/admin/users/{id}/sponsor', undefined)
    await changeUser(fake.api, {
      action: 'profile',
      id: 7,
      name: ' kotori ',
      email: ' k@example.test ',
      language: 'ja',
      contentLimit: 3,
    })
    await changeUser(fake.api, {
      action: 'ban',
      id: 7,
      days: 7,
      reason: ' spam ',
      removeComments: true,
    })
    await changeUser(fake.api, {
      action: 'ban',
      id: 7,
      days: null,
      reason: 'spam',
      removeComments: false,
    })
    await changeUser(fake.api, { action: 'unban', id: 7 })
    await changeUser(fake.api, { action: 'password', id: 7, password: 'new-secret' })
    await changeUser(fake.api, { action: 'logout', id: 7 })
    await changeUser(fake.api, { action: 'trust', id: 7, trusted: true })
    await changeUser(fake.api, { action: 'role', id: 7, role: 2 })
    await changeUser(fake.api, { action: 'badge', id: 7, until: null })
    expect(fake.requests.map(request => [request.method, new URL(request.url).pathname])).toEqual([
      ['PATCH', '/admin/users/7/profile'],
      ['POST', '/admin/users/7/ban'],
      ['POST', '/admin/users/7/ban'],
      ['POST', '/admin/users/7/unban'],
      ['POST', '/admin/users/7/reset-password'],
      ['POST', '/admin/users/7/force-logout'],
      ['PATCH', '/admin/users/7/upload-trust'],
      ['PATCH', '/admin/users/7/role'],
      ['PATCH', '/admin/users/7/sponsor'],
    ])
    const [profile, timed, forever] = await Promise.all(
      fake.requests.slice(0, 3).map(request => request.json()),
    )
    expect(profile).toEqual({
      name: 'kotori',
      email: 'k@example.test',
      lang: 'ja',
      content_limit: 3,
    })
    expect(timed).toEqual({
      banned_reason: 'spam',
      delete_user_comments: true,
      is_permanent: false,
      banned_duration_days: 7,
    })
    expect(forever).toEqual({
      banned_reason: 'spam',
      delete_user_comments: false,
      is_permanent: true,
    })
    await expect(fake.requests[8]?.json()).resolves.toEqual({ sponsor_expires_at: null })
  })
})
