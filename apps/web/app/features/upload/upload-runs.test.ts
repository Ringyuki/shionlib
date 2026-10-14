import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '~/shared/api/error'
import { BusinessCode } from '~/shared/api/generated/business-codes'
import type { HashWorker } from './file-hasher'
import { fakeServer, setupManager, tenBytes } from './upload-testing'

const report = (server: ReturnType<typeof fakeServer>) => server.called('POST', '/uploads/failures')

const unreadable: HashWorker = {
  start: (_file, _size, receive) =>
    queueMicrotask(() =>
      receive({
        kind: 'error',
        name: 'NotReadableError',
        message: 'The requested file could not be read',
      }),
    ),
  terminate: () => undefined,
}

function refused(status: number, code: number, message: string) {
  const body = { code, message, data: { errors: null }, requestId: 'req-1', timestamp: '' }
  const response = Response.json(body, { status, headers: { 'cf-ray': 'a4a581a96a8ce353-NRT' } })
  return ApiError.fromResponse(response, body)
}

describe('UploadRuns', () => {
  it('records why an upload failed, with the tries before it', async () => {
    const server = fakeServer()
    let sends = 0
    const { manager } = setupManager(server, {
      send: async () => {
        sends += 1
        if (sends === 1) {
          throw new TypeError('Network request failed')
        }
        const invalid = BusinessCode.GAME_UPLOAD_INVALID_CHUNK_SHA256
        throw refused(422, invalid, '分片校验失败')
      },
    })
    manager.add({ kind: 'append', resourceId: 4 }, 'ゲーム', [{ file: tenBytes() }])
    await vi.waitFor(() => expect(report(server)).toBeDefined(), { timeout: 3000 })
    expect(manager.getSnapshot().uploads[0]?.phase).toMatchObject({
      name: 'failed',
      reason: 'differentFile',
      error: { name: 'ApiError', status: 422, ray: 'a4a581a96a8ce353-NRT' },
    })
    expect(report(server)).toMatchObject({
      client: 'this-browser',
      body: {
        session_id: 1,
        stage: 'chunk',
        reason: 'different_file',
        error: {
          name: 'ApiError',
          message: '分片校验失败',
          status: 422,
          code: BusinessCode.GAME_UPLOAD_INVALID_CHUNK_SHA256,
          ray: 'a4a581a96a8ce353-NRT',
        },
        file_name: 'game.7z',
        file_size: 10,
        attempts: [
          { wait: 'network', error: { name: 'TypeError', message: 'Network request failed' } },
        ],
      },
    })
  })

  it('tells a file the browser cannot read from a refusal', async () => {
    const server = fakeServer()
    const { manager } = setupManager(server, { hashWorker: () => unreadable })
    manager.add({ kind: 'append', resourceId: 4 }, 'ゲーム', [{ file: tenBytes() }])
    await vi.waitFor(() => expect(report(server)).toBeDefined())
    expect(manager.getSnapshot().uploads[0]?.phase).toMatchObject({
      name: 'failed',
      reason: 'unreadable',
    })
    expect(report(server)?.body).toEqual({
      session_id: 1,
      stage: 'read',
      reason: 'unreadable',
      error: { name: 'NotReadableError', message: 'The requested file could not be read' },
      chunk: 0,
      file_name: 'game.7z',
      file_size: 10,
    })
    expect(server.calls.some(call => call.method === 'PUT')).toBe(false)
  })

  it('records why the resource could not be made from finished uploads', async () => {
    const page = new Response('<html>Attention Required! | Cloudflare</html>', {
      status: 403,
      headers: { 'cf-ray': 'a4a581a96a8ce353-NRT', 'content-type': 'text/html' },
    })
    const server = fakeServer([], { '/game/3/download-source': page })
    const { manager } = setupManager(server)
    const resource = {
      platform: ['win' as const],
      language: ['jp' as const],
      form: 'portable' as const,
    }
    manager.add({ kind: 'create', gameId: 3, resource }, 'ゲーム', [{ file: tenBytes() }])
    await vi.waitFor(() => expect(report(server)).toBeDefined())
    expect(manager.getSnapshot().submissions[0]?.phase).toMatchObject({
      name: 'failed',
      error: { name: 'ApiError', status: 403, ray: 'a4a581a96a8ce353-NRT' },
    })
    expect(report(server)?.body).toMatchObject({
      stage: 'submit',
      reason: 'rejected',
      error: { name: 'ApiError', status: 403, code: 403, ray: 'a4a581a96a8ce353-NRT' },
      file_name: 'ゲーム',
      file_size: 10,
    })
  })
})
