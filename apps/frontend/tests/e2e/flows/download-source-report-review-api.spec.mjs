import { expect, test } from '@playwright/test'
import {
  E2E_FIXTURES,
  findGameIdByTitle,
  loginAndExtractAuthCookies,
} from '../_helpers/fixtures.mjs'

const expectApiSuccess = async response => {
  if (!response.ok()) {
    const body = await response.text()
    throw new Error(`Expected success response, got ${response.status()}: ${body}`)
  }
  const payload = await response.json()
  expect(payload?.code).toBe(0)
  return payload?.data
}

test.describe('Download source report review api flow', () => {
  test('should support reporter submit + admin review(valid) + user view reflects resource removal', async ({
    request,
  }) => {
    const reporterAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.login.identifier,
      E2E_FIXTURES.users.login.password,
    )
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    const reporterHeaders = { cookie: reporterAuth.cookieHeader }
    const adminHeaders = { cookie: adminAuth.cookieHeader }

    const primaryGameId = await findGameIdByTitle(request, E2E_FIXTURES.games.primary.title)
    const reportableNote = `E2E reportable resource ${Date.now()}`
    let reportableResourceId = null

    try {
      reportableResourceId = await expectApiSuccess(
        await request.post(`/api/game/download-source/migrate/${primaryGameId}`, {
          headers: adminHeaders,
          data: {
            platform: ['win'],
            language: ['en'],
            note: reportableNote,
          },
        }),
      )
      expect(Number.isInteger(Number(reportableResourceId))).toBeTruthy()

      await expect
        .poll(async () => {
          const listData = await expectApiSuccess(
            await request.get('/api/game/download-source/list?page=1&pageSize=50', {
              headers: reporterHeaders,
            }),
          )
          const resources = Array.isArray(listData?.items) ? listData.items : []
          const resource = resources.find(item => item?.id === reportableResourceId)
          return resource?.note
        })
        .toBe(reportableNote)

      const report = await expectApiSuccess(
        await request.post(`/api/game/download-source/${reportableResourceId}/report`, {
          headers: reporterHeaders,
          data: {
            reason: 'OTHER',
            detail: `E2E report flow ${Date.now()}`,
          },
        }),
      )
      expect(report?.id).toBeDefined()
      expect(report?.status).toBe('PENDING')

      await expect
        .poll(async () => {
          const reportList = await expectApiSuccess(
            await request.get(
              '/api/admin/content/download-resource-reports?page=1&pageSize=20&sortBy=created&sortOrder=desc',
              {
                headers: adminHeaders,
              },
            ),
          )
          return reportList?.items?.some(item => item?.id === report.id)
        })
        .toBe(true)

      const reviewed = await expectApiSuccess(
        await request.patch(`/api/admin/content/download-resource-reports/${report.id}/review`, {
          headers: adminHeaders,
          data: {
            verdict: 'VALID',
            malicious_level: 'LOW',
            process_note: 'e2e valid review',
            notify: false,
          },
        }),
      )
      expect(reviewed?.id).toBe(report.id)
      expect(reviewed?.status).toBe('VALID')

      const reportDetail = await expectApiSuccess(
        await request.get(`/api/admin/content/download-resource-reports/${report.id}`, {
          headers: adminHeaders,
        }),
      )
      expect(reportDetail?.id).toBe(report.id)
      expect(reportDetail?.status).toBe('VALID')

      await expect
        .poll(async () => {
          const listData = await expectApiSuccess(
            await request.get('/api/game/download-source/list?page=1&pageSize=50', {
              headers: reporterHeaders,
            }),
          )
          const resources = Array.isArray(listData?.items) ? listData.items : []
          return resources.some(item => item?.id === reportableResourceId)
        })
        .toBe(false)
    } finally {
      if (!reportableResourceId) {
        return
      }
      try {
        await request.delete(`/api/game/download-source/${reportableResourceId}`, {
          headers: adminHeaders,
        })
      } catch (error) {
        console.warn('Best-effort cleanup failed for reportable resource', error)
      }
    }
  })
})
