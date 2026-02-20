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

test.describe('Comment api flow', () => {
  test('should support create/reply/edit/like/unlike/delete lifecycle for comments', async ({
    request,
  }) => {
    const authCookies = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.login.identifier,
      E2E_FIXTURES.users.login.password,
    )
    const authHeaders = { cookie: authCookies.cookieHeader }

    const primaryGameId = await findGameIdByTitle(request, E2E_FIXTURES.games.primary.title)
    const rootText = `E2E root comment ${Date.now()}`
    const replyText = `E2E reply comment ${Date.now()}`
    const editedReplyText = `E2E edited reply ${Date.now()}`

    const rootComment = await expectApiSuccess(
      await request.post(`/api/comment/game/${primaryGameId}`, {
        headers: authHeaders,
        data: {
          content: makeLexicalContent(rootText),
        },
      }),
    )
    expect(rootComment?.id).toBeDefined()

    const replyComment = await expectApiSuccess(
      await request.post(`/api/comment/game/${primaryGameId}`, {
        headers: authHeaders,
        data: {
          content: makeLexicalContent(replyText),
          parent_id: rootComment.id,
        },
      }),
    )
    expect(replyComment?.id).toBeDefined()
    expect(replyComment?.parent_id).toBe(rootComment.id)

    const commentsAfterCreate = await expectApiSuccess(
      await request.get(`/api/comment/game/${primaryGameId}?page=1&pageSize=50`, {
        headers: authHeaders,
      }),
    )
    const createdRootInList = commentsAfterCreate.items.find(
      comment => comment.id === rootComment.id,
    )
    const createdReplyInList = commentsAfterCreate.items.find(
      comment => comment.id === replyComment.id,
    )
    expect(createdRootInList).toBeDefined()
    expect(createdReplyInList).toBeDefined()

    await expectApiSuccess(
      await request.post(`/api/comment/${replyComment.id}/like`, {
        headers: authHeaders,
      }),
    )

    const commentsAfterLike = await expectApiSuccess(
      await request.get(`/api/comment/game/${primaryGameId}?page=1&pageSize=50`, {
        headers: authHeaders,
      }),
    )
    const likedReply = commentsAfterLike.items.find(comment => comment.id === replyComment.id)
    expect(likedReply?.is_liked).toBeTruthy()
    expect(likedReply?.like_count).toBeGreaterThanOrEqual(1)

    await expectApiSuccess(
      await request.post(`/api/comment/${replyComment.id}/like`, {
        headers: authHeaders,
      }),
    )

    const commentsAfterUnlike = await expectApiSuccess(
      await request.get(`/api/comment/game/${primaryGameId}?page=1&pageSize=50`, {
        headers: authHeaders,
      }),
    )
    const unlikedReply = commentsAfterUnlike.items.find(comment => comment.id === replyComment.id)
    expect(unlikedReply?.is_liked).toBeFalsy()

    await expectApiSuccess(
      await request.patch(`/api/comment/${replyComment.id}`, {
        headers: authHeaders,
        data: {
          content: makeLexicalContent(editedReplyText),
        },
      }),
    )

    const rawReply = await expectApiSuccess(
      await request.get(`/api/comment/${replyComment.id}/raw`, {
        headers: authHeaders,
      }),
    )
    const rawText = rawReply?.content?.root?.children?.[0]?.children?.find(
      node => node?.type === 'text',
    )?.text
    expect(rawText).toBe(editedReplyText)

    await expectApiSuccess(
      await request.delete(`/api/comment/${replyComment.id}`, {
        headers: authHeaders,
      }),
    )
    await expectApiSuccess(
      await request.delete(`/api/comment/${rootComment.id}`, {
        headers: authHeaders,
      }),
    )

    const commentsAfterDelete = await expectApiSuccess(
      await request.get(`/api/comment/game/${primaryGameId}?page=1&pageSize=50`, {
        headers: authHeaders,
      }),
    )
    expect(commentsAfterDelete.items.some(comment => comment.id === rootComment.id)).toBe(false)
    expect(commentsAfterDelete.items.some(comment => comment.id === replyComment.id)).toBe(false)
  })

  test('guest should not be able to create comment', async ({ request }) => {
    const primaryGameId = await findGameIdByTitle(request, E2E_FIXTURES.games.primary.title)
    const response = await request.post(`/api/comment/game/${primaryGameId}`, {
      data: {
        content: makeLexicalContent('guest create should fail'),
      },
    })
    expect(response.status()).toBe(401)
    const payload = await response.json()
    expect(payload?.code).not.toBe(0)
  })
})
