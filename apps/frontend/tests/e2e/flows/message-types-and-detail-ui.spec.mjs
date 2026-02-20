import { expect, test } from '@playwright/test'
import {
  E2E_FIXTURES,
  applyAuthCookiesToPageContext,
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

const ensureCommentLikeMessage = async request => {
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

  const primaryGameId = await findGameIdByTitle(request, E2E_FIXTURES.games.primary.title)
  const createdComment = await expectApiSuccess(
    await request.post(`/api/comment/game/${primaryGameId}`, {
      headers: userHeaders,
      data: {
        content: makeLexicalContent(`Message detail UI trigger ${Date.now()}`),
      },
    }),
  )
  expect(createdComment?.id).toBeDefined()

  await expectApiSuccess(
    await request.post(`/api/comment/${createdComment.id}/like`, {
      headers: adminHeaders,
    }),
  )

  for (let i = 0; i < 12; i += 1) {
    const likeMessageList = await expectApiSuccess(
      await request.get('/api/message/list?page=1&pageSize=15&type=COMMENT_LIKE', {
        headers: userHeaders,
      }),
    )
    if (Array.isArray(likeMessageList?.items) && likeMessageList.items.length > 0) {
      return userAuth
    }
    await sleep(200)
  }

  throw new Error('Failed to observe COMMENT_LIKE message in list after trigger action.')
}

test.describe('Message type switch and detail UI', () => {
  test('sidebar should switch message type routes by click', async ({ page, request }) => {
    const authCookies = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.login.identifier,
      E2E_FIXTURES.users.login.password,
    )
    await applyAuthCookiesToPageContext(page, authCookies)

    const response = await page.goto('/en/message?page=1')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    await page.getByRole('link', { name: 'System messages' }).click()
    await expect(page).toHaveURL(/\/en\/message\/system(?:\?.*)?$/)

    await page.getByRole('link', { name: 'Comment replies' }).click()
    await expect(page).toHaveURL(/\/en\/message\/comment-reply(?:\?.*)?$/)

    await page.getByRole('link', { name: 'Comment likes' }).click()
    await expect(page).toHaveURL(/\/en\/message\/comment-like(?:\?.*)?$/)
  })

  test('message item click should open detail dialog', async ({ page, request }) => {
    const userAuth = await ensureCommentLikeMessage(request)
    await applyAuthCookiesToPageContext(page, userAuth)

    const response = await page.goto('/en/message/comment-like?page=1')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    const messageCard = page
      .locator('[data-slot="card"]')
      .filter({
        has: page.locator('h3'),
      })
      .first()

    await expect(messageCard).toBeVisible()
    await messageCard.click()

    await expect(page.getByRole('heading', { name: 'Message Details' })).toBeVisible()
    await expect(page.getByText('From Game')).toBeVisible()
  })
})
