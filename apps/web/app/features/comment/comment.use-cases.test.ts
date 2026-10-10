import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { ApiData } from '~/shared/api/types'
import type { RichDocument } from '~/shared/richtext/rich-text'
import {
  countComments,
  editComment,
  loadComments,
  postComment,
  toggleLike,
} from './comment.use-cases'

const threads = (
  totalItems: number,
  comments: number,
  currentPage = 1,
): ApiData<'/comment/game/{game_id}', 'get'> => ({
  items: null,
  meta: { currentPage, itemCount: 0, itemsPerPage: 20, totalItems, totalPages: 1, comments },
})

const creator = { id: 2, name: 'kotori', avatar: null, is_sponsor: false }

const written: RichDocument = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: '好', marks: [{ type: 'bold' }] }] },
  ],
}

const stored = {
  id: 9,
  content: written,
  text: '好',
  parent_id: null,
  root_id: 9,
  creator,
  status: 2,
  created: '2026-10-09T00:00:00Z',
  updated: '2026-10-09T00:00:00Z',
}

const created: ApiData<'/comment/game/{game_id}', 'post'> = {
  ...stored,
  parent: null,
  like_count: 0,
}

const edited: ApiData<'/comment/{comment_id}', 'patch'> = { ...stored, edited: true }

describe('loadComments', () => {
  it('asks for a page of threads in the chosen order', async () => {
    const fake = fakeApi().on('get', '/comment/game/{game_id}', threads(12, 30, 2))
    await expect(loadComments(fake.api, 7, 2, 'oldest')).resolves.toEqual({
      gameId: 7,
      threads: [],
      total: 12,
      count: 30,
      page: 2,
      order: 'oldest',
    })
    const asked = new URL(fake.requests[0]?.url ?? '')
    expect(asked.pathname).toBe('/comment/game/7')
    expect(Object.fromEntries(asked.searchParams)).toEqual({
      page: '2',
      pageSize: '20',
      order: 'oldest',
    })
  })

  it('opens the page that holds a comment, whichever page was asked for', async () => {
    const fake = fakeApi().on('get', '/comment/game/{game_id}', threads(64, 90, 3))
    await expect(loadComments(fake.api, 7, 1, 'newest', 41)).resolves.toMatchObject({ page: 3 })
    expect(new URL(fake.requests[0]?.url ?? '').searchParams.get('focus')).toBe('41')
  })

  it('counts every comment of a game, replies included', async () => {
    const fake = fakeApi().on('get', '/comment/game/{game_id}', threads(12, 30))
    await expect(countComments(fake.api, 7)).resolves.toBe(30)
    expect(new URL(fake.requests[0]?.url ?? '').searchParams.get('pageSize')).toBe('1')
  })
})

describe('writing', () => {
  it('posts the document under the comment it answers and tells which comment it became', async () => {
    const fake = fakeApi().on('post', '/comment/game/{game_id}', created)
    await expect(postComment(fake.api, { gameId: 7, parentId: 3, content: written })).resolves.toBe(
      9,
    )
    const sent = fake.requests[0]
    expect(new URL(sent?.url ?? '').pathname).toBe('/comment/game/7')
    await expect(sent?.json()).resolves.toEqual({ parent_id: 3, content: written })
  })

  it('leaves the parent out of a comment that starts a thread', async () => {
    const fake = fakeApi().on('post', '/comment/game/{game_id}', created)
    await postComment(fake.api, { gameId: 7, content: written })
    await expect(fake.requests[0]?.json()).resolves.not.toHaveProperty('parent_id')
  })

  it('saves an edit and toggles a like on the comment', async () => {
    const fake = fakeApi()
      .on('patch', '/comment/{comment_id}', edited)
      .on('post', '/comment/{comment_id}/like', undefined)
    await editComment(fake.api, { commentId: 9, content: written })
    await toggleLike(fake.api, { commentId: 9 })
    expect(
      fake.requests.map(request => `${request.method} ${new URL(request.url).pathname}`),
    ).toEqual(['PATCH /comment/9', 'POST /comment/9/like'])
  })
})
