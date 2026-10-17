import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { PatchPages } from './admin-patch-page'
import { assignPatchPages, loadPatchPages, lookUpPatchPage } from './admin-patch-page.use-cases'

const pages: PatchPages = {
  manual: true,
  vndb_id: null,
  bangumi_id: null,
  matched: [],
  assigned: [],
}

describe('loadPatchPages', () => {
  it('reads the pages of one game and remembers which', async () => {
    const fake = fakeApi().on('get', '/admin/content/games/{id}/patch-pages', pages)
    expect(await loadPatchPages(fake.api, 27697)).toEqual({ id: 27697, pages })
    expect(new URL(fake.requests[0]?.url ?? '').pathname).toBe(
      '/admin/content/games/27697/patch-pages',
    )
  })
})

describe('assignPatchPages', () => {
  it('sends the pages only when they are assigned by hand', async () => {
    const fake = fakeApi().on('put', '/admin/content/games/{id}/patch-pages', undefined)
    await assignPatchPages(fake.api, { id: 20549, manual: true, pages: ['10363', '211652'] })
    await assignPatchPages(fake.api, { id: 20549, manual: false, pages: ['10363'] })
    const bodies = await Promise.all(fake.requests.map(request => request.json()))
    expect(bodies).toEqual([
      { manual: true, pages: ['10363', '211652'] },
      { manual: false, pages: [] },
    ])
  })
})

describe('lookUpPatchPage', () => {
  it('asks what an address points to', async () => {
    const page = {
      id: '212857',
      url: 'https://www.moyu.moe/galgame/212857',
      title: null,
      resources: 1,
      via: null,
    }
    const fake = fakeApi().on('post', '/admin/content/patch-pages/lookup', page)
    expect(
      await lookUpPatchPage(fake.api, { address: 'https://www.moyu.moe/resource/11421' }),
    ).toEqual(page)
    expect(await fake.requests[0]?.json()).toEqual({
      address: 'https://www.moyu.moe/resource/11421',
    })
  })
})
