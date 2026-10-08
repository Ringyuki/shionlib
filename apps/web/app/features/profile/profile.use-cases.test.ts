import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { ApiData } from '~/shared/api/types'
import { loadProfile, loadUploads } from './profile.use-cases'

const page: ApiData<'/user/datas/{id}/game-resources', 'get'> = {
  items: null,
  meta: {
    currentPage: 2,
    itemCount: 0,
    itemsPerPage: 24,
    totalItems: 30,
    totalPages: 2,
    content_limit: 0,
    has_on_going_session: false,
    is_current_user: false,
  },
}

describe('loadProfile', () => {
  it('lets a missing user fail the page', async () => {
    const fake = fakeApi().fail('get', '/user/{id}', 404, { code: 300101, message: 'not found' })
    await expect(loadProfile(fake.api, 99)).rejects.toMatchObject({ status: 404 })
    expect(new URL(fake.requests[0]?.url ?? '').pathname).toBe('/user/99')
  })
})

describe('loadUploads', () => {
  it('asks for one page of the resources a user uploaded', async () => {
    const fake = fakeApi().on('get', '/user/datas/{id}/game-resources', page)
    await expect(loadUploads(fake.api, 3, 2)).resolves.toEqual({ items: [], total: 30, page: 2 })
    const sent = new URL(fake.requests[0]?.url ?? '')
    expect(sent.pathname).toBe('/user/datas/3/game-resources')
    expect(Object.fromEntries(sent.searchParams)).toEqual({ page: '2', pageSize: '24' })
  })
})
