import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { ApiData } from '~/shared/api/types'
import { blankInfo } from './resource-info'
import {
  editResource,
  loadAllowance,
  loadMoyuEntries,
  loadResourceEvents,
  loadResourcePage,
  previewName,
  readName,
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
    missing_volumes: [],
    volumes_deadline: null,
    translation: null,
    translators: [],
    patch_version: null,
    release_url: null,
    edition: null,
    edition_name: null,
    form: null,
    extras: [],
    canonical_name: false,
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
  it('reads the resource, then the header of its game and what its files were found to hold', async () => {
    const fake = fakeApi()
      .on('get', '/game/download-source/{id}', detail)
      .on('get', '/game/{id}/header', header)
      .on('get', '/inspection/resource/{resource_id}', null)
    await expect(loadResourcePage(fake.api, 31)).resolves.toEqual({
      resource: detail.resource,
      game: header,
      inspections: [],
    })
    expect(fake.requests.map(request => new URL(request.url).pathname)).toEqual([
      '/game/download-source/31',
      '/game/7/header',
      '/inspection/resource/31',
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

describe('editResource', () => {
  it('sends the fields of the resource with its information', async () => {
    const fake = fakeApi().on('patch', '/game/download-source/{id}', undefined)
    await editResource(fake.api, {
      resourceId: 31,
      platform: ['win'],
      language: ['zh'],
      simulator: 'KRKR',
      note: ' 附带特典 ',
      ...blankInfo,
      translation: 'group',
      translators: ['绿茶汉化组'],
      patchVersion: 'v1.1',
      form: 'portable',
    })
    const [request] = fake.requests
    expect(new URL(request?.url ?? '').pathname).toBe('/game/download-source/31')
    await expect(request?.json()).resolves.toEqual({
      platform: ['win'],
      language: ['zh'],
      note: '附带特典',
      translation: 'group',
      translators: ['绿茶汉化组'],
      patch_version: 'v1.1',
      form: 'portable',
      extras: [],
      canonical_name: true,
    })
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

describe('names', () => {
  it('asks what the first file of an upload would be called', async () => {
    const name = { before: 'ゲーム (files)', after: '.7z', pending: false }
    const fake = fakeApi().on('post', '/game/{id}/download-source/name', name)
    await expect(
      previewName(fake.api, {
        ...blankInfo,
        gameId: 10,
        fileName: 'upload.7z',
        language: ['jp'],
        form: 'portable',
      }),
    ).resolves.toEqual(name)
    const [request] = fake.requests
    expect(new URL(request?.url ?? '').pathname).toBe('/game/10/download-source/name')
    await expect(request?.json()).resolves.toEqual({
      language: ['jp'],
      file_name: 'upload.7z',
      form: 'portable',
    })
  })

  it('asks what the name of a file says', async () => {
    const reading = {
      translation: null,
      translators: [],
      patch_version: null,
      edition: null,
      edition_name: null,
      form: null,
    }
    const fake = fakeApi().on('post', '/game/download-source/name/read', reading)
    await expect(readName(fake.api, 'upload.7z')).resolves.toEqual(reading)
    await expect(fake.requests[0]?.json()).resolves.toEqual({ file_name: 'upload.7z' })
  })
})

describe('loadMoyuEntries', () => {
  const path = '/moyu/game/{gameId}/patches'

  it('asks for what the other site lists for a game', async () => {
    const entries: ApiData<typeof path, 'get'> = [
      {
        id: 'r1',
        kind: 'save',
        name: '',
        size: null,
        language: ['jp'],
        platform: ['win'],
        translation: null,
        translator: null,
        model: null,
        downloads: 3,
        url: 'https://www.moyu.moe/resource/r1',
        updated: '2026-07-09T08:00:00Z',
        publisher: null,
      },
    ]
    const fake = fakeApi().on('get', path, entries)
    await expect(loadMoyuEntries(fake.api, 12)).resolves.toEqual(entries)
    expect(new URL(fake.requests[0]?.url ?? '').pathname).toBe('/moyu/game/12/patches')
  })

  it('has none when the other site cannot be reached, without failing the page', async () => {
    const fake = fakeApi().fail('get', path, 502, { code: 610102, message: 'failed' })
    await expect(loadMoyuEntries(fake.api, 12)).resolves.toEqual([])
    await expect(loadMoyuEntries(fakeApi().on('get', path, null).api, 12)).resolves.toEqual([])
  })
})
