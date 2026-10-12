import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { Schema } from '~/shared/api/types'
import { loadHistory, loadSettings, saveSettings } from './admin-setting.use-cases'

const raw = (name: string, value: unknown): Schema<'SettingDTO'> => ({
  name,
  group: 'upload',
  kind: 'int',
  label: name,
  description: '',
  value,
  default: 3,
  overridden: false,
  last_change: null,
})

describe('loadSettings', () => {
  it('reads every setting it understands', async () => {
    const { api } = fakeApi().on('get', '/admin/settings', [
      raw('upload.a', 3),
      raw('upload.b', 'x'),
    ])
    await expect(loadSettings(api)).resolves.toMatchObject([{ name: 'upload.a', value: 3 }])
  })

  it('answers an empty list when there is none', async () => {
    const { api } = fakeApi().on('get', '/admin/settings', null)
    await expect(loadSettings(api)).resolves.toEqual([])
  })
})

describe('saveSettings', () => {
  it('changes what was edited and restores what went back to its default', async () => {
    const fake = fakeApi()
      .on('patch', '/admin/settings/{name}', raw('upload.a', 5))
      .on('delete', '/admin/settings/{name}', raw('upload.b', 3))
    await saveSettings(fake.api, {
      changes: [
        { name: 'upload.a', value: 5, restore: false },
        { name: 'upload.b', value: 3, restore: true },
      ],
    })
    expect(fake.requests.map(request => [request.method, new URL(request.url).pathname])).toEqual([
      ['PATCH', '/admin/settings/upload.a'],
      ['DELETE', '/admin/settings/upload.b'],
    ])
    await expect(fake.requests[0]?.json()).resolves.toEqual({ value: 5 })
  })

  it('surfaces a value the API refuses', async () => {
    const fake = fakeApi().fail('patch', '/admin/settings/{name}', 422, {
      code: 100101,
      message: 'invalid',
    })
    await expect(
      saveSettings(fake.api, { changes: [{ name: 'upload.a', value: -1, restore: false }] }),
    ).rejects.toMatchObject({ status: 422 })
  })
})

describe('loadHistory', () => {
  it('reads the latest changes of one setting', async () => {
    const fake = fakeApi().on('get', '/admin/settings/{name}/history', {
      items: [{ id: 4, previous: 8, value: null, editor: null, created: 'x' }],
      meta: { currentPage: 1, itemCount: 1, itemsPerPage: 50, totalItems: 1, totalPages: 1 },
    })
    await expect(loadHistory(fake.api, 'download.max_conns')).resolves.toEqual([
      { id: 4, editor: undefined, at: 'x', previous: 8, value: undefined },
    ])
    const asked = new URL(fake.requests[0]?.url ?? '')
    expect(asked.pathname).toBe('/admin/settings/download.max_conns/history')
    expect(asked.searchParams.get('pageSize')).toBe('50')
  })
})
