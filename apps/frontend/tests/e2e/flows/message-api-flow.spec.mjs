import { expect, test } from '@playwright/test'
import {
  E2E_FIXTURES,
  findGameIdByTitle,
  loginAndExtractAuthCookies,
} from '../_helpers/fixtures.mjs'

const expectApiSuccess = async response => {
  expect(response.ok()).toBeTruthy()
  const payload = await response.json()
  expect(payload?.code).toBe(0)
  return payload?.data
}

const makeLexicalContent = text => ({
  root: {
    type: 'root',
    version: 1,
    format: '',
    indent: 0,
    direction: null,
    children: [
      {
        type: 'paragraph',
        version: 1,
        format: '',
        indent: 0,
        direction: null,
        children: [
          {
            type: 'text',
            version: 1,
            text,
            mode: 'normal',
            style: '',
            detail: 0,
            format: 0,
          },
        ],
      },
    ],
  },
})

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

test.describe('Message api flow', () => {
  test('should support unread/list/detail and read-state toggles', async ({ request }) => {
    const userAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.login.identifier,
      E2E_FIXTURES.users.login.password,
    )
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    const userHeaders = { cookie: userAuth.cookieHeader }
    const adminHeaders = { cookie: adminAuth.cookieHeader }

    const unreadBefore = await expectApiSuccess(
      await request.get('/api/message/unread', {
        headers: userHeaders,
      }),
    )

    const primaryGameId = await findGameIdByTitle(request, E2E_FIXTURES.games.primary.title)
    const comment = await expectApiSuccess(
      await request.post(`/api/comment/game/${primaryGameId}`, {
        headers: userHeaders,
        data: {
          content: makeLexicalContent(`Message trigger comment ${Date.now()}`),
        },
      }),
    )
    expect(comment?.id).toBeDefined()

    await expectApiSuccess(
      await request.post(`/api/comment/${comment.id}/like`, {
        headers: adminHeaders,
      }),
    )

    let unreadAfterLike = unreadBefore
    for (let i = 0; i < 10; i++) {
      unreadAfterLike = await expectApiSuccess(
        await request.get('/api/message/unread', {
          headers: userHeaders,
        }),
      )
      if (unreadAfterLike > unreadBefore) {
        break
      }
      await sleep(200)
    }
    expect(unreadAfterLike).toBeGreaterThan(unreadBefore)

    const unreadList = await expectApiSuccess(
      await request.get('/api/message/list?page=1&pageSize=20&unread=true&type=COMMENT_LIKE', {
        headers: userHeaders,
      }),
    )
    expect(Array.isArray(unreadList?.items)).toBeTruthy()
    expect(unreadList.items.length).toBeGreaterThan(0)
    const latestLikeMessage = unreadList.items[0]
    expect(latestLikeMessage?.id).toBeDefined()
    expect(latestLikeMessage?.read).toBe(false)

    const messageDetail = await expectApiSuccess(
      await request.get(`/api/message/${latestLikeMessage.id}`, {
        headers: userHeaders,
      }),
    )
    expect(messageDetail?.id).toBe(latestLikeMessage.id)
    expect(messageDetail?.type).toBe('COMMENT_LIKE')

    const unreadAfterDetailRead = await expectApiSuccess(
      await request.get('/api/message/unread', {
        headers: userHeaders,
      }),
    )
    expect(unreadAfterDetailRead).toBeLessThan(unreadAfterLike + 1)

    await expectApiSuccess(
      await request.post('/api/message/all/unread', {
        headers: userHeaders,
      }),
    )
    const unreadAfterMarkAllUnread = await expectApiSuccess(
      await request.get('/api/message/unread', {
        headers: userHeaders,
      }),
    )
    expect(unreadAfterMarkAllUnread).toBeGreaterThanOrEqual(1)

    await expectApiSuccess(
      await request.post(`/api/message/${latestLikeMessage.id}/read`, {
        headers: userHeaders,
      }),
    )

    await expectApiSuccess(
      await request.post('/api/message/all/read', {
        headers: userHeaders,
      }),
    )
    const unreadAfterMarkAllRead = await expectApiSuccess(
      await request.get('/api/message/unread', {
        headers: userHeaders,
      }),
    )
    expect(unreadAfterMarkAllRead).toBeGreaterThanOrEqual(0)

    const detailAfterMarkAllRead = await expectApiSuccess(
      await request.get(`/api/message/${latestLikeMessage.id}`, {
        headers: userHeaders,
      }),
    )
    expect(detailAfterMarkAllRead?.read).toBe(true)
  })
})
