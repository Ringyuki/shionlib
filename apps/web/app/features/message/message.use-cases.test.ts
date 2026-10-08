import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { ApiData } from '~/shared/api/types'
import { countUnread, loadInbox, markAllRead } from './message.use-cases'

const unauthorized = { code: 200101, message: 'unauthorized' }

const page: ApiData<'/message/list', 'get'> = {
  items: null,
  meta: { currentPage: 2, itemCount: 0, itemsPerPage: 30, totalItems: 31, totalPages: 2 },
}

describe('loadInbox', () => {
  it('opens the message first, so the list and the count already know it was read', async () => {
    const fake = fakeApi()
      .on('get', '/message/list', page)
      .on('get', '/message/unread', 4)
      .on('get', '/message/{id}', {
        id: 14,
        type: 'SYSTEM',
        tone: 'INFO',
        title: 't',
        content: 'c',
        link_text: null,
        link_url: null,
        external_link: false,
        meta: null,
        comment: null,
        game: null,
        sender: null,
        receiver: { id: 1, name: 'a', avatar: null, is_sponsor: false },
        read: true,
        read_at: null,
        created: '2026-10-08T00:00:00Z',
        updated: '2026-10-08T00:00:00Z',
      })
    await expect(loadInbox(fake.api, 'system', 2, 14)).resolves.toMatchObject({
      category: 'system',
      page: 2,
      items: [],
      total: 31,
      unread: 4,
      opened: { id: 14 },
    })
    const [first, ...rest] = fake.requests.map(request => new URL(request.url))
    expect(first?.pathname).toBe('/message/14')
    const list = rest.find(url => url.pathname === '/message/list')
    expect(Object.fromEntries(list?.searchParams ?? [])).toEqual({
      page: '2',
      pageSize: '30',
      type: 'SYSTEM',
    })
  })

  it('lists every type without a category and treats a missing message as none opened', async () => {
    const fake = fakeApi()
      .on('get', '/message/list', page)
      .on('get', '/message/unread', 0)
      .fail('get', '/message/{id}', 404, { code: 470101, message: 'not found' })
    await expect(loadInbox(fake.api, 'all', 1, 99)).resolves.toMatchObject({ opened: null })
    const list = fake.requests
      .map(request => new URL(request.url))
      .find(url => url.pathname === '/message/list')
    expect(list?.searchParams.has('type')).toBe(false)
  })

  it('is nothing for a guest', async () => {
    const fake = fakeApi()
      .fail('get', '/message/list', 401, unauthorized)
      .fail('get', '/message/unread', 401, unauthorized)
    await expect(loadInbox(fake.api, 'all', 1, undefined)).resolves.toBeNull()
  })
})

describe('countUnread', () => {
  it('counts for a viewer and is zero for a guest', async () => {
    await expect(countUnread(fakeApi().on('get', '/message/unread', 3).api)).resolves.toBe(3)
    const guest = fakeApi().fail('get', '/message/unread', 401, unauthorized)
    await expect(countUnread(guest.api)).resolves.toBe(0)
    const broken = fakeApi().fail('get', '/message/unread', 500, { code: 500, message: 'down' })
    await expect(countUnread(broken.api)).rejects.toMatchObject({ status: 500 })
  })
})

describe('markAllRead', () => {
  it('marks every message read', async () => {
    const fake = fakeApi().on('post', '/message/all/read', undefined)
    await markAllRead(fake.api)
    expect(new URL(fake.requests[0]?.url ?? '').pathname).toBe('/message/all/read')
  })
})
