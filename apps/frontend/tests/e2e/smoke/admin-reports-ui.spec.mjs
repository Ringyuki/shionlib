import { expect, test } from '@playwright/test'
import {
  E2E_FIXTURES,
  applyAuthCookiesToPageContext,
  findGameIdByTitle,
  loginAndExtractAuthCookies,
} from '../_helpers/fixtures.mjs'

const expectApiSuccess = async response => {
  if (!response.ok()) {
    const body = await response.text().catch(() => '<unreadable>')
    throw new Error(`Request failed: ${response.status()} ${response.url()} body=${body}`)
  }
  const payload = await response.json()
  expect(payload?.code).toBe(0)
  return payload?.data
}

const getAdminReportDetail = async (request, adminAuth, reportId) => {
  return await expectApiSuccess(
    await request.get(`/api/admin/content/download-resource-reports/${reportId}`, {
      headers: {
        cookie: adminAuth.cookieHeader,
      },
    }),
  )
}

const waitForReportStatus = async (
  request,
  adminAuth,
  reportId,
  expectedStatus,
  timeoutMs = 10_000,
) => {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const detail = await getAdminReportDetail(request, adminAuth, reportId)
    if (detail?.status === expectedStatus) {
      return detail
    }
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  throw new Error(`Timed out waiting report status=${expectedStatus}, id=${reportId}`)
}

const createReportFixture = async (request, adminAuth, userAuth) => {
  const timestamp = Date.now()
  const gameId = await findGameIdByTitle(request, E2E_FIXTURES.games.secondary.title)

  const resourceId = await expectApiSuccess(
    await request.post(`/api/game/download-source/migrate/${gameId}`, {
      headers: {
        cookie: adminAuth.cookieHeader,
      },
      data: {
        platform: ['win'],
        language: ['en'],
        note: `e2e report resource note ${timestamp}`,
      },
    }),
  )
  expect(typeof resourceId).toBe('number')

  await expectApiSuccess(
    await request.post(`/api/game/download-source/migrate/file/${resourceId}`, {
      headers: {
        cookie: adminAuth.cookieHeader,
      },
      data: {
        file_name: `e2e-report-${timestamp}.zip`,
        file_size: 1024,
        file_hash: `e2e-hash-${timestamp}`,
        file_content_type: 'application/zip',
        s3_file_key: `e2e/reports/${timestamp}.zip`,
      },
    }),
  )

  const detailText = `e2e report detail ${timestamp}`
  const report = await expectApiSuccess(
    await request.post(`/api/game/download-source/${resourceId}/report`, {
      headers: {
        cookie: userAuth.cookieHeader,
      },
      data: {
        reason: 'MALWARE',
        detail: detailText,
      },
    }),
  )

  expect(report?.id).toBeDefined()

  return {
    reportId: report.id,
    resourceId,
    detailText,
  }
}

const filterReportsByResourceId = async (page, resourceId) => {
  const resourceIdInput = page.getByPlaceholder('Resource ID')
  await expect(resourceIdInput).toBeVisible()

  const responsePromise = page.waitForResponse(response => {
    const url = response.url()
    return (
      url.includes('/admin/content/download-resource-reports') &&
      url.includes(`resource_id=${resourceId}`)
    )
  })

  await resourceIdInput.fill(String(resourceId))
  await resourceIdInput.blur()
  await responsePromise
}

const findReportRow = async (page, reportId, timeoutMs = 15_000) => {
  const row = page
    .locator('div.rounded-lg.border.p-4')
    .filter({
      hasText: `Report ID: ${reportId}`,
    })
    .first()
  await expect(row).toBeVisible({ timeout: timeoutMs })
  return row
}

test.describe('Admin reports UI', () => {
  test('reports page should support list filtering and detail dialog', async ({
    page,
    request,
  }) => {
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    const userAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.login.identifier,
      E2E_FIXTURES.users.login.password,
    )
    await applyAuthCookiesToPageContext(page, adminAuth)

    const { reportId, resourceId, detailText } = await createReportFixture(
      request,
      adminAuth,
      userAuth,
    )
    await waitForReportStatus(request, adminAuth, reportId, 'PENDING')

    const response = await page.goto('/en/admin/reports')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    await filterReportsByResourceId(page, resourceId)
    const row = await findReportRow(page, reportId)
    await expect(row.getByText('Contains malware/virus')).toBeVisible()

    await row.getByRole('button', { name: 'View Details' }).click()
    await expect(page.getByRole('heading', { name: 'Report Details' })).toBeVisible()
    const detailDialog = page.getByRole('dialog').first()
    await expect(detailDialog.getByText(detailText)).toBeVisible()
  })

  test('report detail dialog should support moderation review submission', async ({
    page,
    request,
  }) => {
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    const userAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.login.identifier,
      E2E_FIXTURES.users.login.password,
    )
    await applyAuthCookiesToPageContext(page, adminAuth)

    const { reportId, resourceId } = await createReportFixture(request, adminAuth, userAuth)
    await waitForReportStatus(request, adminAuth, reportId, 'PENDING')

    const response = await page.goto('/en/admin/reports')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    await filterReportsByResourceId(page, resourceId)
    const row = await findReportRow(page, reportId)
    await row.getByRole('button', { name: 'View Details' }).click()
    await expect(page.getByRole('heading', { name: 'Report Details' })).toBeVisible()
    const detailDialog = page.getByRole('dialog').first()
    await expect(detailDialog.getByText('Pending')).toBeVisible()

    const processNote = `e2e review note ${Date.now()}`
    await detailDialog.getByPlaceholder('Add moderation note (optional)').fill(processNote)

    const verdictSelectTrigger = detailDialog.locator('button[role="combobox"]').first()
    await verdictSelectTrigger.click()
    await page.getByRole('option', { name: 'Mark as Invalid' }).click()

    const notifyCheckbox = detailDialog.getByRole('checkbox')
    await expect(notifyCheckbox).toHaveAttribute('aria-checked', 'true')
    await notifyCheckbox.click()
    await expect(notifyCheckbox).toHaveAttribute('aria-checked', 'false')

    const reviewResponse = page.waitForResponse(response => {
      return (
        response.request().method() === 'PATCH' &&
        response.url().includes(`/admin/content/download-resource-reports/${reportId}/review`)
      )
    })

    await detailDialog.getByRole('button', { name: 'Submit Review' }).click()
    await expectApiSuccess(await reviewResponse)
    await expect(page.getByRole('heading', { name: 'Report Details' })).toBeHidden()

    const reviewedDetail = await waitForReportStatus(request, adminAuth, reportId, 'INVALID')
    expect(reviewedDetail?.process_note).toBe(processNote)
    expect(reviewedDetail?.processed_at).toBeTruthy()
    expect(reviewedDetail?.processor?.id).toBeDefined()
  })
})
