import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { ApiData } from '~/shared/api/types'
import {
  loadAllowance,
  loadResourceEvents,
  loadResourcePage,
  removeFile,
  renameFile,
} from './resource.use-cases'

const detail: ApiData<'/game/download-source/{id}', 'get'> = {
  resource: {
    id: 31,
    platform: ['win'],
    language: ['jp'],
    simulator: null,
    note: null,
    downloads: 571,
    creator: { id: 9, name: 'ringyuki', avatar: null, is_sponsor: false },
    published_at: '2026-09-25T02:25:43Z',
    created: '2026-09-25T02:25:43Z',
    updated: '2026-09-25T02:25:43Z',
    comments: 4,
    files: null,
  },
  game: {
    id: 7,
    title_jp: 'タイトル',
    title_zh: '',
    title_en: '',
    aliases: null,
    type: null,
    covers: null,
    intro_jp: '',
    intro_zh: '',
    intro_en: '',
    release_date: null,
    developers: null,
    resources: { count: 1, downloads: 571, platforms: null, languages: null, latest: null },
    tags: null,
  },
}

const header: ApiData<'/game/{id}/header', 'get'> = {
  id: 7,
  title_jp: 'タイトル',
  title_zh: '标题',
  title_en: '',
  v_id: 'v17',
  b_id: null,
  h_id: 42,
  extra_info: null,
  aliases: null,
  covers: null,
  developers: null,
  release_date: null,
  release_date_tba: false,
  type: null,
  platform: null,
  content_limit: 0,
}

describe('loadResourcePage', () => {
  it('reads the resource and then the header of its game, which names the game to a manager', async () => {
    const fake = fakeApi()
      .on('get', '/game/download-source/{id}', detail)
      .on('get', '/game/{id}/header', header)
    await expect(loadResourcePage(fake.api, 31)).resolves.toEqual({
      resource: detail.resource,
      game: header,
    })
    expect(fake.requests.map(request => new URL(request.url).pathname)).toEqual([
      '/game/download-source/31',
      '/game/7/header',
    ])
  })

  it('is not found when the viewer may not see the resource', async () => {
    const fake = fakeApi().fail('get', '/game/download-source/{id}', 404, {
      code: 440101,
      message: 'not found',
    })
    await expect(loadResourcePage(fake.api, 31)).rejects.toMatchObject({ status: 404 })
    expect(fake.requests).toHaveLength(1)
  })
})

describe('loadResourceEvents', () => {
  it('reads a history that is still empty as no events', async () => {
    const fake = fakeApi().on('get', '/game/download-source/{id}/events', null)
    await expect(loadResourceEvents(fake.api, 31)).resolves.toEqual([])
    expect(new URL(fake.requests[0]?.url ?? '').pathname).toBe('/game/download-source/31/events')
  })
})

describe('renameFile', () => {
  it('sends the trimmed name of the file', async () => {
    const fake = fakeApi().on('patch', '/game/download-source/file/{fileId}', undefined)
    await renameFile(fake.api, { fileId: 12, name: '  game.part1.rar ' })
    const [request] = fake.requests
    expect(new URL(request?.url ?? '').pathname).toBe('/game/download-source/file/12')
    await expect(request?.json()).resolves.toEqual({ file_name: 'game.part1.rar' })
  })

  it('lets the reason through when the name is taken', async () => {
    const fake = fakeApi().fail('patch', '/game/download-source/file/{fileId}', 409, {
      code: 440106,
      message: 'duplicate',
    })
    await expect(renameFile(fake.api, { fileId: 12, name: 'a.rar' })).rejects.toMatchObject({
      status: 409,
      message: 'duplicate',
    })
  })
})

describe('removeFile', () => {
  it('removes the file by its id', async () => {
    const fake = fakeApi().on('delete', '/game/download-source/file/{fileId}', undefined)
    await removeFile(fake.api, { fileId: 7 })
    const [request] = fake.requests
    expect(request?.method).toBe('DELETE')
    expect(new URL(request?.url ?? '').pathname).toBe('/game/download-source/file/7')
  })
})

describe('loadAllowance', () => {
  it('has none for a guest', async () => {
    const fake = fakeApi().fail('get', '/uploads/quota', 401, { code: 200101, message: 'sign in' })
    await expect(loadAllowance(fake.api)).resolves.toBeNull()
  })

  it('lets other failures through', async () => {
    const fake = fakeApi().fail('get', '/uploads/quota', 500, { code: 500, message: 'failed' })
    await expect(loadAllowance(fake.api)).rejects.toMatchObject({ status: 500 })
  })
})
