import { expect, test } from '@playwright/test'
import {
  E2E_FIXTURES,
  applyAuthCookiesToPageContext,
  ensureUiLoggedIn,
  findGameIdByTitle,
  loginAndExtractAuthCookies,
} from '../_helpers/fixtures.mjs'

const expectApiSuccess = async response => {
  expect(response.ok()).toBeTruthy()
  const payload = await response.json()
  expect(payload?.code).toBe(0)
  return payload?.data
}

const waitForCommentCreateResponse = async (page, gameId) => {
  const response = await page.waitForResponse(response => {
    return (
      response.request().method() === 'POST' &&
      response.url().includes(`/api/comment/game/${gameId}`) &&
      response.status() < 400
    )
  })

  const payload = await response.json()
  expect(payload?.code).toBe(0)
  expect(payload?.data?.id).toBeDefined()
  return payload.data.id
}

const waitForCommentDeleteResponse = async (page, commentId) => {
  const response = await page.waitForResponse(response => {
    return (
      response.request().method() === 'DELETE' &&
      response.url().includes(`/api/comment/${commentId}`) &&
      response.status() < 400
    )
  })
  const payload = await response.json()
  expect(payload?.code).toBe(0)
}

test.describe('Comment UI flow', () => {
  test('should create/reply/delete comments through real UI actions', async ({ page, request }) => {
    test.setTimeout(120_000)
    const authCookies = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.login.identifier,
      E2E_FIXTURES.users.login.password,
    )
    const authHeaders = { cookie: authCookies.cookieHeader }
    const gameId = await findGameIdByTitle(request, E2E_FIXTURES.games.primary.title)

    const rootText = `E2E UI root comment ${Date.now()}`
    const replyText = `E2E UI reply comment ${Date.now()}`

    let rootCommentId = null
    let replyCommentId = null

    await applyAuthCookiesToPageContext(page, authCookies)

    try {
      const response = await page.goto(`/en/game/${gameId}/comments`)
      expect(response).not.toBeNull()
      expect(response.ok()).toBeTruthy()

      await ensureUiLoggedIn(
        page,
        E2E_FIXTURES.users.login.identifier,
        E2E_FIXTURES.users.login.password,
      )

      const commentContent = page.locator('#comment-content')
      const rootEditor = commentContent
        .locator('.ContentEditable__root[contenteditable="true"]')
        .first()
      await expect(rootEditor).toBeVisible()
      await rootEditor.click()
      await page.keyboard.type(rootText)

      const createPromise = waitForCommentCreateResponse(page, gameId)
      await commentContent
        .getByRole('button', { name: /submit/i })
        .first()
        .click()
      rootCommentId = await createPromise
      expect(rootCommentId).toBeGreaterThan(0)

      await expect(page.getByTestId(`comment-item-${rootCommentId}`)).toBeVisible({
        timeout: 15_000,
      })
      await expect(page.getByTestId(`comment-body-${rootCommentId}`)).toContainText(rootText)
      await page.waitForLoadState('networkidle')

      await page.getByTestId(`comment-reply-${rootCommentId}`).click()
      const rootCard = page.getByTestId(`comment-item-${rootCommentId}`)
      const replyEditor = rootCard.locator('.ContentEditable__root[contenteditable="true"]').first()
      await expect(replyEditor).toBeVisible()
      await replyEditor.click()
      await page.keyboard.type(replyText)

      const replyCreatePromise = waitForCommentCreateResponse(page, gameId)
      await rootCard
        .getByRole('button', { name: /submit/i })
        .first()
        .click()
      replyCommentId = await replyCreatePromise
      expect(replyCommentId).toBeGreaterThan(0)

      await expect(page.getByTestId(`comment-item-${replyCommentId}`)).toBeVisible({
        timeout: 15_000,
      })
      await expect(page.getByTestId(`comment-body-${replyCommentId}`)).toContainText(replyText)
      await page.waitForLoadState('networkidle')

      const latestComments = await expectApiSuccess(
        await request.get(`/api/comment/game/${gameId}?page=1&pageSize=50`, {
          headers: authHeaders,
        }),
      )
      expect(latestComments?.items?.some(comment => comment?.id === rootCommentId)).toBe(true)
      expect(latestComments?.items?.some(comment => comment?.id === replyCommentId)).toBe(true)

      await page.getByTestId(`comment-more-actions-${replyCommentId}`).click()
      await page.getByTestId(`comment-delete-${replyCommentId}`).click()
      const deleteReplyPromise = waitForCommentDeleteResponse(page, replyCommentId)
      await page.getByTestId(`comment-delete-confirm-${replyCommentId}`).click()
      await deleteReplyPromise
      await expect(page.getByTestId(`comment-item-${replyCommentId}`)).toHaveCount(0)
      replyCommentId = null

      await page.getByTestId(`comment-more-actions-${rootCommentId}`).click()
      await page.getByTestId(`comment-delete-${rootCommentId}`).click()
      const deleteRootPromise = waitForCommentDeleteResponse(page, rootCommentId)
      await page.getByTestId(`comment-delete-confirm-${rootCommentId}`).click()
      await deleteRootPromise
      await expect(page.getByTestId(`comment-item-${rootCommentId}`)).toHaveCount(0)
      rootCommentId = null
    } finally {
      if (replyCommentId) {
        try {
          await request.delete(`/api/comment/${replyCommentId}`, {
            headers: authHeaders,
          })
        } catch {}
      }
      if (rootCommentId) {
        try {
          await request.delete(`/api/comment/${rootCommentId}`, {
            headers: authHeaders,
          })
        } catch {}
      }
    }
  })
})
