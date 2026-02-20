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

test.describe('Download source CRUD api flow', () => {
  test('should support list + migrate create + edit + delete(non-s3-key resource)', async ({
    request,
  }) => {
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    const adminHeaders = { cookie: adminAuth.cookieHeader }

    const primaryGameId = await findGameIdByTitle(request, E2E_FIXTURES.games.primary.title)

    const beforeList = await expectApiSuccess(
      await request.get('/api/game/download-source/list?page=1&pageSize=50', {
        headers: adminHeaders,
      }),
    )
    expect(Array.isArray(beforeList?.items)).toBeTruthy()

    const createdResourceId = await expectApiSuccess(
      await request.post(`/api/game/download-source/migrate/${primaryGameId}`, {
        headers: adminHeaders,
        data: {
          platform: ['win'],
          language: ['en'],
          note: `E2E migrate resource ${Date.now()}`,
        },
      }),
    )
    expect(Number.isInteger(Number(createdResourceId))).toBeTruthy()

    await expectApiSuccess(
      await request.post(`/api/game/download-source/migrate/file/${createdResourceId}`, {
        headers: adminHeaders,
        data: {
          file_name: 'e2e-migrate-file.zip',
          file_size: 4096,
          file_hash: `e2e-migrate-hash-${Date.now()}`,
          file_content_type: 'application/zip',
          s3_file_key: `e2e/migrate/${Date.now()}.zip`,
        },
      }),
    )

    const gameResourcesAfterCreate = await expectApiSuccess(
      await request.get(`/api/game/${primaryGameId}/download-source`, {
        headers: adminHeaders,
      }),
    )
    const createdResource = gameResourcesAfterCreate.find(item => item?.id === createdResourceId)
    expect(createdResource?.id).toBe(createdResourceId)
    expect(createdResource?.files?.[0]?.file_name).toBe('e2e-migrate-file.zip')

    await expectApiSuccess(
      await request.patch(`/api/game/download-source/${createdResourceId}`, {
        headers: adminHeaders,
        data: {
          platform: ['win', 'lin'],
          language: ['en', 'jp'],
          note: 'E2E migrate resource edited',
          file_name: 'e2e-migrate-file-edited.zip',
        },
      }),
    )

    const gameResourcesAfterEdit = await expectApiSuccess(
      await request.get(`/api/game/${primaryGameId}/download-source`, {
        headers: adminHeaders,
      }),
    )
    const editedResource = gameResourcesAfterEdit.find(item => item?.id === createdResourceId)
    expect(editedResource?.note).toBe('E2E migrate resource edited')
    expect(editedResource?.files?.[0]?.file_name).toBe('e2e-migrate-file-edited.zip')

    const deleteCandidateId = await expectApiSuccess(
      await request.post(`/api/game/download-source/migrate/${primaryGameId}`, {
        headers: adminHeaders,
        data: {
          platform: ['win'],
          language: ['en'],
          note: `E2E delete candidate ${Date.now()}`,
        },
      }),
    )
    expect(Number.isInteger(Number(deleteCandidateId))).toBeTruthy()

    await expectApiSuccess(
      await request.delete(`/api/game/download-source/${deleteCandidateId}`, {
        headers: adminHeaders,
      }),
    )

    const listAfterDelete = await expectApiSuccess(
      await request.get('/api/game/download-source/list?page=1&pageSize=50', {
        headers: adminHeaders,
      }),
    )
    expect(listAfterDelete.items.some(item => item?.id === deleteCandidateId)).toBe(false)
  })
})
