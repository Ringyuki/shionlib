import { afterEach, describe, expect, it, vi } from 'vitest'
import { uploadChunk } from './chunk'
import { ApiError } from './error'
import { fakeXhr, type FakeXhrReply } from './xhr-testing'

function install(reply: FakeXhrReply) {
  const fake = fakeXhr(() => reply)
  vi.stubGlobal('XMLHttpRequest', fake.XMLHttpRequest)
  return fake
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('uploadChunk', () => {
  it('puts the chunk with its digest and reports progress', async () => {
    const fake = install({
      status: 200,
      progress: [2, 4],
      text: JSON.stringify({ code: 0, message: 'ok', data: { ok: true, chunk_index: 3 } }),
    })
    const content = new Blob(['abcd'])
    const progress: number[] = []
    const stored = await uploadChunk({
      id: 12,
      index: 3,
      client: 'this-browser',
      content,
      sha256: 'digest',
      onProgress: sent => progress.push(sent),
    })
    expect(stored).toEqual({ ok: true, chunk_index: 3 })
    expect(progress).toEqual([2, 4])
    expect(fake.sent[0]).toEqual({
      method: 'PUT',
      url: '/api/uploads/large/12/chunks/3',
      headers: {
        'chunk-sha256': 'digest',
        'content-type': 'application/octet-stream',
        'x-upload-client': 'this-browser',
      },
      body: content,
    })
  })

  it('throws the business failure', async () => {
    install({ status: 409, text: JSON.stringify({ code: 480108, message: '分片校验值不符' }) })
    const error = await uploadChunk({
      id: 1,
      index: 0,
      client: 'this-browser',
      content: new Blob(['x']),
      sha256: 'x',
    }).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 409, code: 480108 })
  })

  it('keeps the Ray ID of a page a proxy answered with', async () => {
    install({
      status: 403,
      text: '<html>Attention Required! | Cloudflare</html>',
      headers: { 'cf-ray': 'a4a581a96a8ce353-NRT', 'content-type': 'text/html' },
    })
    const error = await uploadChunk({
      id: 1,
      index: 0,
      client: 'this-browser',
      content: new Blob(['x']),
      sha256: 'x',
    }).catch((caught: unknown) => caught)
    expect(error).toMatchObject({ status: 403, code: 403, ray: 'a4a581a96a8ce353-NRT' })
    expect(error instanceof ApiError && error.failure.requestId).toBe('')
  })
})
