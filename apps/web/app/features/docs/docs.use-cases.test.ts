import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { ApiData } from '~/shared/api/types'
import { loadAuthors } from './docs.use-cases'

const profile: ApiData<'/user/{id}', 'get'> = {
  id: 1,
  name: 'ringyuki',
  avatar: 'user/1/avatar/a.webp',
  background: null,
  bio: null,
  cover: null,
  created: '2025-01-01T00:00:00.000Z',
  role: 3,
  status: 1,
  is_admin: true,
  is_banned: false,
  is_sponsor: false,
  sponsor_expires_at: null,
  comment_count: 0,
  edit_count: 0,
  favorite_count: 0,
  resource_count: 0,
  walkthrough_count: 0,
}

const paths = (requests: readonly Request[]) =>
  requests.map(request => new URL(request.url).pathname)

describe('loadAuthors', () => {
  it('reads each author from the site, in the order the document gives them', async () => {
    const fake = fakeApi().on('get', '/user/{id}', profile)
    const authors = await loadAuthors(fake.api, [3625, 1])
    expect(authors).toEqual([
      { id: 3625, name: 'ringyuki', avatar: 'user/1/avatar/a.webp' },
      { id: 1, name: 'ringyuki', avatar: 'user/1/avatar/a.webp' },
    ])
    expect(paths(fake.requests).toSorted()).toEqual(['/user/1', '/user/3625'])
  })

  it('leaves out an author who is no longer a user', async () => {
    const fake = fakeApi().fail('get', '/user/{id}', 404, { code: 300101, message: 'not found' })
    await expect(loadAuthors(fake.api, [9060])).resolves.toEqual([])
  })

  it('asks for nobody when the document names no author', async () => {
    const fake = fakeApi()
    await expect(loadAuthors(fake.api, [])).resolves.toEqual([])
    expect(fake.requests).toEqual([])
  })

  it('lets any other failure fail the page', async () => {
    const fake = fakeApi().fail('get', '/user/{id}', 500, { code: 500, message: 'down' })
    await expect(loadAuthors(fake.api, [1])).rejects.toMatchObject({ status: 500 })
  })
})
