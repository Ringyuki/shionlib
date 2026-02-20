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

const waitForCommentStatus = async (
  request,
  adminAuth,
  commentId,
  expectedStatus,
  timeoutMs = 10_000,
) => {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const detail = await expectApiSuccess(
      await request.get(`/api/admin/comments/${commentId}`, {
        headers: {
          cookie: adminAuth.cookieHeader,
        },
      }),
    )
    if (detail?.status === expectedStatus) {
      return detail
    }
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  throw new Error(`Timed out waiting comment status=${expectedStatus}, id=${commentId}`)
}

const getCommentRow = async (page, commentId, timeoutMs = 15_000) => {
  const rowByTestId = page.getByTestId(`admin-comment-row-${commentId}`).first()
  try {
    await expect(rowByTestId).toBeVisible({ timeout: 1_000 })
    return rowByTestId
  } catch {}

  const rowByText = page
    .locator('div.rounded-lg.border.p-4')
    .filter({
      hasText: `Comment ID: ${commentId}`,
    })
    .first()
  await expect(rowByText).toBeVisible({ timeout: timeoutMs })
  return rowByText
}

const openCommentActionsMenu = async (page, row, commentId) => {
  const triggerByTestId = page.getByTestId(`admin-comment-actions-trigger-${commentId}`).first()
  const hasTestIdTrigger = (await triggerByTestId.count()) > 0
  if (hasTestIdTrigger) {
    await expect(triggerByTestId).toBeVisible()
    await triggerByTestId.click()
  } else {
    const fallbackTrigger = row.getByRole('button').first()
    await expect(fallbackTrigger).toBeVisible()
    await fallbackTrigger.click()
  }

  const menuByTestId = page.getByTestId(`admin-comment-actions-menu-${commentId}`).first()
  const hasTestIdMenu = (await menuByTestId.count()) > 0
  if (hasTestIdMenu) {
    await expect(menuByTestId).toBeVisible()
    return
  }
  await expect(page.getByRole('menuitem').first()).toBeVisible()
}

const clickCommentAction = async (page, commentId, actionKey, fallbackNames) => {
  const actionByTestId = page.getByTestId(`admin-comment-action-${actionKey}-${commentId}`).first()
  if ((await actionByTestId.count()) > 0) {
    await actionByTestId.click()
    return
  }

  for (const name of fallbackNames) {
    const actionByText = page.getByRole('menuitem', { name }).first()
    if ((await actionByText.count()) > 0) {
      await actionByText.click()
      return
    }
  }

  throw new Error(`Failed to locate comment action: ${actionKey}, id=${commentId}`)
}

test.describe('Admin comments UI', () => {
  test('comments page should support search filtering', async ({ page, request }) => {
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    await applyAuthCookiesToPageContext(page, adminAuth)

    const response = await page.goto('/en/admin/comments')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    await expect(page).toHaveURL(/\/en\/admin\/comments(?:\?.*)?$/)

    const searchInput = page.getByPlaceholder('Search by content, user, game or ID')
    await expect(searchInput).toBeVisible()

    const searchKeyword = E2E_FIXTURES.comments.root.split(' ')[0]
    const responsePromise = page.waitForResponse(response => {
      const url = response.url()
      return (
        url.includes('/admin/comments') &&
        url.includes(`search=${encodeURIComponent(searchKeyword)}`)
      )
    })

    await searchInput.fill(searchKeyword)
    await responsePromise

    await expect(page.getByText(E2E_FIXTURES.comments.root).first()).toBeVisible()
  })

  test('comment detail action should open detail dialog', async ({ page, request }) => {
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    await applyAuthCookiesToPageContext(page, adminAuth)

    const listPayload = await expectApiSuccess(
      await request.get('/api/admin/comments?page=1&pageSize=20', {
        headers: {
          cookie: adminAuth.cookieHeader,
        },
      }),
    )
    expect(Array.isArray(listPayload?.items)).toBeTruthy()
    expect(listPayload.items.length).toBeGreaterThan(0)
    const targetCommentId = listPayload.items[0].id

    const response = await page.goto('/en/admin/comments')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    const targetCommentCard = page
      .locator('div.rounded-lg.border.p-4')
      .filter({
        hasText: `Comment ID: ${targetCommentId}`,
      })
      .first()
    await expect(targetCommentCard).toBeVisible()

    const menuTrigger = targetCommentCard.locator('button').first()
    await expect(menuTrigger).toBeVisible()
    await menuTrigger.click()

    await page.getByRole('menuitem', { name: 'View Details' }).click()

    await expect(page.getByRole('heading', { name: 'Comment Details' })).toBeVisible()
    await expect(page.getByText('Comment Content', { exact: true })).toBeVisible()
  })

  test('should support review status updates and rescan action for comments', async ({
    page,
    request,
  }) => {
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    await applyAuthCookiesToPageContext(page, adminAuth)

    const userAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.login.identifier,
      E2E_FIXTURES.users.login.password,
    )

    const primaryGameId = await findGameIdByTitle(request, E2E_FIXTURES.games.primary.title)
    const commentText = `Admin review/rescan e2e ${Date.now()}`

    const createdComment = await expectApiSuccess(
      await request.post(`/api/comment/game/${primaryGameId}`, {
        headers: {
          cookie: userAuth.cookieHeader,
        },
        data: {
          content: makeLexicalContent(commentText),
        },
      }),
    )
    expect(createdComment?.id).toBeDefined()
    const targetCommentId = createdComment.id

    const response = await page.goto('/en/admin/comments')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    const searchKeyword = String(targetCommentId)
    const searchInput = page.getByPlaceholder('Search by content, user, game or ID')
    await expect(searchInput).toBeVisible()
    const searchResponse = page.waitForResponse(res => {
      const url = res.url()
      return url.includes('/admin/comments') && url.includes(`search=${searchKeyword}`)
    })
    await searchInput.fill(searchKeyword)
    await searchResponse

    const row = await getCommentRow(page, targetCommentId)

    await openCommentActionsMenu(page, row, targetCommentId)
    await clickCommentAction(page, targetCommentId, 'approve', ['Approve', 'Restore'])
    await waitForCommentStatus(request, adminAuth, targetCommentId, 1)

    await openCommentActionsMenu(page, row, targetCommentId)
    await clickCommentAction(page, targetCommentId, 'hide', ['Hide'])
    await waitForCommentStatus(request, adminAuth, targetCommentId, 2)

    await openCommentActionsMenu(page, row, targetCommentId)
    await clickCommentAction(page, targetCommentId, 'delete', ['Delete'])

    const deleteDialog = page.getByTestId(`admin-comment-delete-dialog-${targetCommentId}`).first()
    if ((await deleteDialog.count()) > 0) {
      await expect(deleteDialog).toBeVisible()
      await page.getByTestId(`admin-comment-delete-confirm-${targetCommentId}`).click()
    } else {
      const fallbackDialog = page.getByRole('alertdialog').last()
      await expect(fallbackDialog).toBeVisible()
      await fallbackDialog.getByRole('button', { name: 'Confirm' }).click()
    }
    await waitForCommentStatus(request, adminAuth, targetCommentId, 3)

    await openCommentActionsMenu(page, row, targetCommentId)
    await clickCommentAction(page, targetCommentId, 'approve', ['Approve', 'Restore'])
    await waitForCommentStatus(request, adminAuth, targetCommentId, 1)

    await openCommentActionsMenu(page, row, targetCommentId)
    await clickCommentAction(page, targetCommentId, 'rescan', ['Rescan'])
    await waitForCommentStatus(request, adminAuth, targetCommentId, 2)
  })
})
