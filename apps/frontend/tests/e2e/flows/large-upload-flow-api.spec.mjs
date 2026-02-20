import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createBLAKE3 } from 'hash-wasm'
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

const hashBlake3Hex = async data => {
  const hasher = await createBLAKE3()
  hasher.update(new Uint8Array(data))
  return hasher.digest('hex')
}

const hashSha256Hex = data => createHash('sha256').update(data).digest('hex')

const initUploadSession = async (request, headers, fileName, content, chunkSize) => {
  const fileHash = await hashBlake3Hex(content)
  return await expectApiSuccess(
    await request.post('/api/uploads/large/init', {
      headers,
      data: {
        file_name: fileName,
        total_size: content.length,
        chunk_size: chunkSize,
        file_sha256: fileHash,
      },
    }),
  )
}

test.describe('Large upload api flow', () => {
  test('should support init/chunk/status/complete/abort end-to-end', async ({ request }) => {
    const mutableAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.mutable.identifier,
      E2E_FIXTURES.users.mutable.password,
    )
    const mutableHeaders = { cookie: mutableAuth.cookieHeader }

    const content = Buffer.from('e2e-large-upload-content-'.repeat(128), 'utf8')
    const chunkSize = 512

    const initResult = await initUploadSession(
      request,
      mutableHeaders,
      'e2e-large-upload.bin',
      content,
      chunkSize,
    )
    const uploadSessionId = initResult.upload_session_id
    expect(uploadSessionId).toBeDefined()
    expect(initResult.total_chunks).toBe(Math.ceil(content.length / chunkSize))

    for (let index = 0; index < initResult.total_chunks; index += 1) {
      const start = index * chunkSize
      const end = Math.min(start + chunkSize, content.length)
      const chunk = content.subarray(start, end)
      const chunkSha256 = hashSha256Hex(chunk)

      await expectApiSuccess(
        await request.put(`/api/uploads/large/${uploadSessionId}/chunks/${index}`, {
          headers: {
            ...mutableHeaders,
            'content-type': 'application/octet-stream',
            'content-length': String(chunk.length),
            'chunk-sha256': chunkSha256,
          },
          data: chunk,
        }),
      )
    }

    const statusAfterChunks = await expectApiSuccess(
      await request.get(`/api/uploads/large/${uploadSessionId}/status`, {
        headers: mutableHeaders,
      }),
    )
    expect(statusAfterChunks?.status).toBe('UPLOADING')
    expect(statusAfterChunks?.uploaded_chunks).toEqual([...Array(initResult.total_chunks).keys()])

    const completeResult = await expectApiSuccess(
      await request.patch(`/api/uploads/large/${uploadSessionId}/complete`, {
        headers: mutableHeaders,
      }),
    )
    expect(completeResult?.ok).toBe(true)

    const statusAfterComplete = await expectApiSuccess(
      await request.get(`/api/uploads/large/${uploadSessionId}/status`, {
        headers: mutableHeaders,
      }),
    )
    expect(statusAfterComplete?.status).toBe('COMPLETED')

    const abortContent = Buffer.from('e2e-abort-upload', 'utf8')
    const abortInitResult = await initUploadSession(
      request,
      mutableHeaders,
      'e2e-abort-upload.bin',
      abortContent,
      8,
    )
    const abortSessionId = abortInitResult.upload_session_id
    expect(abortSessionId).toBeDefined()

    await expectApiSuccess(
      await request.delete(`/api/uploads/large/${abortSessionId}`, {
        headers: mutableHeaders,
      }),
    )

    const abortStatus = await expectApiSuccess(
      await request.get(`/api/uploads/large/${abortSessionId}/status`, {
        headers: mutableHeaders,
      }),
    )
    expect(abortStatus?.status).toBe('ABORTED')

    const ongoingSessions = await expectApiSuccess(
      await request.get('/api/uploads/large/ongoing', {
        headers: mutableHeaders,
      }),
    )
    expect(Array.isArray(ongoingSessions)).toBe(true)
    expect(ongoingSessions.some(item => item?.upload_session_id === uploadSessionId)).toBe(false)
    expect(ongoingSessions.some(item => item?.upload_session_id === abortSessionId)).toBe(false)
  })
})
