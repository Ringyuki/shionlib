import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { ApiData } from '~/shared/api/types'
import { removed } from './profile.schema'
import { loadProfile, loadUploads, saveProfile } from './profile.use-cases'

const page: ApiData<'/user/datas/{id}/game-resources', 'get'> = {
  items: null,
  meta: {
    currentPage: 2,
    itemCount: 0,
    itemsPerPage: 20,
    totalItems: 30,
    totalPages: 2,
    content_limit: 0,
    has_on_going_session: false,
    is_current_user: true,
  },
}

const picture = () => new File(['image'], 'a.webp', { type: 'image/webp' })

const paths = (requests: readonly Request[]) =>
  requests.map(request => `${request.method} ${new URL(request.url).pathname}`)

describe('loadProfile', () => {
  it('lets a missing user fail the page', async () => {
    const fake = fakeApi().fail('get', '/user/{id}', 404, { code: 300101, message: 'not found' })
    await expect(loadProfile(fake.api, 99)).rejects.toMatchObject({ status: 404 })
    expect(new URL(fake.requests[0]?.url ?? '').pathname).toBe('/user/99')
  })
})

describe('loadUploads', () => {
  it('asks for one page of the resources a user uploaded and says whose they are', async () => {
    const fake = fakeApi().on('get', '/user/datas/{id}/game-resources', page)
    await expect(loadUploads(fake.api, 3, 2)).resolves.toEqual({
      items: [],
      total: 30,
      page: 2,
      own: true,
    })
    const sent = new URL(fake.requests[0]?.url ?? '')
    expect(sent.pathname).toBe('/user/datas/3/game-resources')
    expect(Object.fromEntries(sent.searchParams)).toEqual({ page: '2', pageSize: '20' })
  })
})

describe('saveProfile', () => {
  const api = () =>
    fakeApi()
      .on('post', '/user/info/bio', { bio: '' })
      .on('post', '/user/info/avatar', { key: 'a' })
      .on('post', '/user/info/cover', { key: 'c' })
      .on('post', '/user/info/background', { key: 'b' })
      .on('delete', '/user/info/cover', undefined)
      .on('delete', '/user/info/background', undefined)

  it('sends only what changed, each picture under its own field', async () => {
    const fake = api()
    await saveProfile(fake.api, { bio: ' 春 ', avatar: picture(), background: picture() })
    expect(paths(fake.requests)).toEqual([
      'POST /user/info/bio',
      'POST /user/info/avatar',
      'POST /user/info/background',
    ])
    await expect(fake.requests[0]?.json()).resolves.toEqual({ bio: '春' })
    expect((await fake.requests[1]?.formData())?.get('avatar')).toBeInstanceOf(File)
    expect((await fake.requests[2]?.formData())?.get('background')).toBeInstanceOf(File)
  })

  it('removes the cover and the background and replaces the cover', async () => {
    const fake = api()
    await saveProfile(fake.api, { cover: removed, background: removed })
    await saveProfile(fake.api, { cover: picture() })
    expect(paths(fake.requests)).toEqual([
      'DELETE /user/info/cover',
      'DELETE /user/info/background',
      'POST /user/info/cover',
    ])
    await saveProfile(fake.api, {})
    expect(fake.requests).toHaveLength(3)
  })

  it('stops at the first refusal', async () => {
    const fake = fakeApi().fail('post', '/user/info/avatar', 415, { code: 490103, message: 'no' })
    await expect(
      saveProfile(fake.api, { avatar: picture(), cover: removed }),
    ).rejects.toMatchObject({ status: 415 })
    expect(fake.requests).toHaveLength(1)
  })
})
