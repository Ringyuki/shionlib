import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const get = vi.fn()
  const post = vi.fn()
  const patch = vi.fn()
  const put = vi.fn()
  const del = vi.fn()

  return {
    get,
    post,
    patch,
    put,
    del,
    requestFactory: vi.fn(() => ({
      get,
      post,
      patch,
      put,
      delete: del,
    })),
  }
})

vi.mock('@/utils/request', () => ({
  shionlibRequest: hoisted.requestFactory,
}))

import { createShionlibLargeFileUploadApi } from '../../../../libs/uploader/large-file-upload.api'

describe('libs/uploader/large-file-upload.api (unit)', () => {
  beforeEach(() => {
    hoisted.get.mockReset()
    hoisted.post.mockReset()
    hoisted.patch.mockReset()
    hoisted.put.mockReset()
    hoisted.del.mockReset()
    hoisted.requestFactory.mockClear()
  })

  it('maps api methods to request client endpoints', async () => {
    hoisted.post.mockResolvedValueOnce({
      data: {
        upload_session_id: 1,
        chunk_size: 1024,
        total_chunks: 3,
        expires_at: '2026-01-01',
      },
    })
    hoisted.get.mockResolvedValueOnce({
      data: {
        status: 'UPLOADING',
        uploaded_chunks: [0],
        file_sha256: 'abc',
        total_size: 10,
        chunk_size: 4,
        total_chunks: 3,
        expires_at: '2026-01-01',
      },
    })
    hoisted.put.mockResolvedValueOnce({ data: { ok: true, chunk_index: 1 } })
    hoisted.patch.mockResolvedValueOnce({ data: { ok: true, path: '/uploads/a' } })
    hoisted.del.mockResolvedValueOnce({ data: null })

    const api = createShionlibLargeFileUploadApi('/uploads/large')
    const signal = new AbortController().signal

    await expect(
      api.init({ file_name: 'a.bin', total_size: 10, file_sha256: 'abc' }, { signal }),
    ).resolves.toMatchObject({ upload_session_id: 1 })

    await expect(api.status(1, { signal })).resolves.toMatchObject({ status: 'UPLOADING' })

    const chunk = new Blob(['1234'])
    await expect(api.putChunk(1, 1, chunk, 'hash', { signal })).resolves.toEqual({
      ok: true,
      chunk_index: 1,
    })

    await expect(api.complete(1, { signal })).resolves.toEqual({ ok: true, path: '/uploads/a' })
    await expect(api.abort(1, { signal })).resolves.toBeUndefined()

    expect(hoisted.post).toHaveBeenCalledWith('/uploads/large/init', {
      data: { file_name: 'a.bin', total_size: 10, file_sha256: 'abc' },
      options: { signal },
    })
    expect(hoisted.get).toHaveBeenCalledWith('/uploads/large/1/status', {
      options: { signal },
    })
    expect(hoisted.put).toHaveBeenCalledWith('/uploads/large/1/chunks/1', {
      options: {
        signal,
        body: chunk,
        headers: {
          'Content-Type': 'application/octet-stream',
          'chunk-sha256': 'hash',
        },
      },
    })
    expect(hoisted.patch).toHaveBeenCalledWith('/uploads/large/1/complete', {
      options: { signal },
    })
    expect(hoisted.del).toHaveBeenCalledWith('/uploads/large/1', {
      options: { signal },
    })
  })
})
