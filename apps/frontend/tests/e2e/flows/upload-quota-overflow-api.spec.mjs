import { expect, test } from '@playwright/test'
import { E2E_FIXTURES, loginAndExtractAuthCookies } from '../_helpers/fixtures.mjs'

const expectApiSuccess = async response => {
  if (!response.ok()) {
    const body = await response.text()
    throw new Error(`Expected success response, got ${response.status()}: ${body}`)
  }
  const payload = await response.json()
  expect(payload?.code).toBe(0)
  return payload?.data
}

test.describe('Upload quota api flow', () => {
  test('should return quota and reject large upload init when quota is exceeded', async ({
    request,
  }) => {
    const userAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.login.identifier,
      E2E_FIXTURES.users.login.password,
    )
    const userHeaders = { cookie: userAuth.cookieHeader }

    const quotaBefore = await expectApiSuccess(
      await request.get('/api/uploads/quota', {
        headers: userHeaders,
      }),
    )
    expect(typeof quotaBefore?.size).toBe('number')
    expect(typeof quotaBefore?.used).toBe('number')
    expect(quotaBefore?.size).toBeGreaterThan(0)

    const initSmallSession = await expectApiSuccess(
      await request.post('/api/uploads/large/init', {
        headers: userHeaders,
        data: {
          file_name: 'e2e-small-upload.bin',
          total_size: 1024,
          chunk_size: 512,
          file_sha256: 'e2e-small-upload-sha256',
        },
      }),
    )
    expect(initSmallSession?.upload_session_id).toBeDefined()

    const quotaAfterSmallInit = await expectApiSuccess(
      await request.get('/api/uploads/quota', {
        headers: userHeaders,
      }),
    )
    expect(quotaAfterSmallInit.used).toBeGreaterThanOrEqual(quotaBefore.used + 1024)

    const remaining = Math.max(1, quotaAfterSmallInit.size - quotaAfterSmallInit.used + 1)
    const overQuotaInit = await request.post('/api/uploads/large/init', {
      headers: userHeaders,
      data: {
        file_name: 'e2e-over-quota-upload.bin',
        total_size: remaining,
        chunk_size: 1024,
        file_sha256: 'e2e-over-quota-upload-sha256',
      },
    })
    expect(overQuotaInit.ok()).toBeFalsy()
    const overQuotaPayload = await overQuotaInit.json()
    expect(overQuotaPayload?.code).not.toBe(0)
    expect(String(overQuotaPayload?.message || '').toLowerCase()).toContain('quota')

    await expectApiSuccess(
      await request.delete(`/api/uploads/large/${initSmallSession.upload_session_id}`, {
        headers: userHeaders,
      }),
    )

    await expect
      .poll(async () => {
        const current = await expectApiSuccess(
          await request.get('/api/uploads/quota', {
            headers: userHeaders,
          }),
        )
        return current.used
      })
      .toBe(quotaBefore.used)
  })
})
