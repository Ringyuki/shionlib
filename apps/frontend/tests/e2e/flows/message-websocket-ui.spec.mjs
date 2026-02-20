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

const resolveMeStatus = page =>
  page.evaluate(async () => {
    const response = await fetch('/api/user/me', {
      credentials: 'include',
    })
    return response.status
  })

const parseBadgeCount = text => {
  if (!text) return 0
  if (text === '99+') return 99
  const numeric = Number(text)
  return Number.isFinite(numeric) ? numeric : 0
}

const applySocketHostCookies = async (page, authCookies) => {
  const socketUrl = process.env.NEXT_PUBLIC_SOCKETIO_URL || 'http://localhost:5235'
  const socketOrigin = new URL(socketUrl)

  await page.context().addCookies([
    {
      name: 'shionlib_access_token',
      value: authCookies.accessToken,
      domain: socketOrigin.hostname,
      httpOnly: true,
      secure: socketOrigin.protocol === 'https:',
      sameSite: 'Lax',
      path: '/',
    },
    {
      name: 'shionlib_refresh_token',
      value: authCookies.refreshToken,
      domain: socketOrigin.hostname,
      httpOnly: true,
      secure: socketOrigin.protocol === 'https:',
      sameSite: 'Lax',
      path: '/',
    },
  ])
}

const loginFromUi = async (page, identifier, password) => {
  const response = await page.goto('/en')
  expect(response).not.toBeNull()
  expect(response.ok()).toBeTruthy()

  const openLoginDialogButton = page.getByRole('button', { name: /^Log in$/ }).first()
  await expect(openLoginDialogButton).toBeVisible()
  await openLoginDialogButton.click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Log in to Shionlib')).toBeVisible()

  await dialog.getByLabel('Email or username').fill(identifier)
  await dialog.getByLabel('Password').fill(password)

  const loginResponsePromise = page.waitForResponse(response => {
    return response.request().method() === 'POST' && response.url().includes('/api/user/login')
  })
  await dialog.getByRole('button', { name: /^Log in$/ }).click()
  const loginResponse = await loginResponsePromise
  expect(loginResponse.ok()).toBeTruthy()

  await expect.poll(() => resolveMeStatus(page)).toBe(200)
  await expect(dialog).toBeHidden()
}

test.describe('Message websocket UI flow', () => {
  test('top bar unread badge should update without page reload when new message arrives', async ({
    page,
    request,
  }) => {
    const receiverAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    const senderAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.login.identifier,
      E2E_FIXTURES.users.login.password,
    )
    const receiverHeaders = { cookie: receiverAuth.cookieHeader }
    const senderHeaders = { cookie: senderAuth.cookieHeader }

    const messageLink = page.locator('a[href="/en/message"]').first()
    const resolveUnreadCount = async () =>
      expectApiSuccess(
        await request.get('/api/message/unread', {
          headers: receiverHeaders,
        }),
      )
    const resolveBadgeText = async () => {
      const badge = messageLink.locator('[data-slot="badge"]')
      const count = await badge.count()
      if (count === 0) return ''
      return (await badge.first().textContent())?.trim() ?? ''
    }
    const resolveBadgeCount = async () => parseBadgeCount(await resolveBadgeText())

    const unreadBefore = await resolveUnreadCount()

    await applySocketHostCookies(page, receiverAuth)
    await loginFromUi(page, E2E_FIXTURES.users.admin.identifier, E2E_FIXTURES.users.admin.password)
    await expect(messageLink).toBeVisible()
    const badgeCountBefore = await resolveBadgeCount()

    const primaryGameId = await findGameIdByTitle(request, E2E_FIXTURES.games.primary.title)
    const createdComment = await expectApiSuccess(
      await request.post(`/api/comment/game/${primaryGameId}`, {
        headers: receiverHeaders,
        data: {
          content: makeLexicalContent(`UI websocket trigger ${Date.now()}`),
        },
      }),
    )
    expect(createdComment?.id).toBeDefined()

    await expectApiSuccess(
      await request.post(`/api/comment/${createdComment.id}/like`, {
        headers: senderHeaders,
      }),
    )

    await expect.poll(resolveUnreadCount).toBeGreaterThan(unreadBefore)
    await expect.poll(resolveBadgeCount).toBeGreaterThan(badgeCountBefore)
  })
})
