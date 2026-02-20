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

const listUnreadMessages = async (request, headers) =>
  expectApiSuccess(
    await request.get('/api/message/list?page=1&pageSize=50&unread=true', {
      headers,
    }),
  )

const findNewUnreadMessageId = async (request, headers, beforeIds) => {
  for (let i = 0; i < 20; i += 1) {
    const unreadList = await listUnreadMessages(request, headers)
    const target = unreadList?.items?.find(item => item?.id && !beforeIds.has(item.id))
    if (target?.id) return target.id
    await sleep(200)
  }
  throw new Error('Unable to locate newly created unread message id in time.')
}

test.describe('Message unread UI flow', () => {
  test('unread tab should reflect unread status and clear after opening message detail', async ({
    page,
    request,
  }) => {
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

    const unreadBefore = await listUnreadMessages(request, userHeaders)
    const unreadBeforeIds = new Set((unreadBefore?.items ?? []).map(item => item.id))

    const primaryGameId = await findGameIdByTitle(request, E2E_FIXTURES.games.primary.title)
    const createdComment = await expectApiSuccess(
      await request.post(`/api/comment/game/${primaryGameId}`, {
        headers: userHeaders,
        data: {
          content: makeLexicalContent(`UI unread flow trigger ${Date.now()}`),
        },
      }),
    )
    expect(createdComment?.id).toBeDefined()

    await expectApiSuccess(
      await request.post(`/api/comment/${createdComment.id}/like`, {
        headers: adminHeaders,
      }),
    )

    const targetMessageId = await findNewUnreadMessageId(request, userHeaders, unreadBeforeIds)
    expect(targetMessageId).toBeGreaterThan(0)

    await applyAuthCookiesToPageContext(page, userAuth)
    const response = await page.goto('/en/message?unread=true&page=1')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    const targetMessageCard = page.getByTestId(`message-item-${targetMessageId}`)
    await expect(targetMessageCard).toBeVisible()

    await targetMessageCard.click()
    await expect(page.getByRole('heading', { name: 'Message Details' })).toBeVisible()

    await expect
      .poll(async () => {
        const message = await expectApiSuccess(
          await request.get(`/api/message/${targetMessageId}`, {
            headers: userHeaders,
          }),
        )
        return message?.read
      })
      .toBe(true)

    const unreadPage = await page.goto('/en/message?unread=true&page=1')
    expect(unreadPage).not.toBeNull()
    expect(unreadPage.ok()).toBeTruthy()

    await expect(page.getByTestId(`message-item-${targetMessageId}`)).toHaveCount(0)
  })
})
