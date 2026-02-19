import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ShionlibLargeFileUploader } from '../../../../libs/uploader/uploader'

const buildApi = () => ({
  init: vi.fn(),
  status: vi.fn(),
  putChunk: vi.fn(),
  complete: vi.fn(),
  abort: vi.fn(),
})

describe('libs/uploader/uploader (unit)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('runs start flow and emits completion events', async () => {
    const file = new File(['hello world'], 'demo.bin')
    const api = buildApi()
    api.init.mockResolvedValue({
      upload_session_id: 11,
      chunk_size: 4,
      total_chunks: 3,
      expires_at: '2026-01-01',
    })
    api.status.mockResolvedValue({
      status: 'UPLOADING',
      uploaded_chunks: [0],
      file_sha256: 'file-hash',
      total_size: file.size,
      chunk_size: 4,
      total_chunks: 3,
      expires_at: '2026-01-01',
    })
    api.complete.mockResolvedValue({ ok: true })

    const uploader = new ShionlibLargeFileUploader(file, {
      api: api as any,
      desiredChunkSize: 8,
      concurrency: 1,
    }) as any

    uploader.hashFile = vi.fn(async () => 'file-hash')
    uploader.uploadAll = vi.fn(async () => undefined)

    const events: any[] = []
    uploader.on((e: any) => events.push(e))

    await uploader.start()

    expect(api.init).toHaveBeenCalledTimes(1)
    expect(api.init).toHaveBeenCalledWith(
      {
        file_name: 'demo.bin',
        total_size: file.size,
        file_sha256: 'file-hash',
        chunk_size: 8,
      },
      { signal: expect.any(AbortSignal) },
    )
    expect(api.status).toHaveBeenCalledWith(11, { signal: expect.any(AbortSignal) })
    expect(api.complete).toHaveBeenCalledWith(11, { signal: expect.any(AbortSignal) })

    expect(await uploader.getSessionId()).toBe(11)
    expect(events.some(e => e.type === 'done' && e.sessionId === 11)).toBe(true)
    expect(events.some(e => e.type === 'status' && e.phase === 'completed')).toBe(true)
  })

  it('cancels active upload and clears session state', async () => {
    const file = new File(['abcd'], 'cancel.bin')
    const api = buildApi()
    api.abort.mockResolvedValue(undefined)

    const uploader = new ShionlibLargeFileUploader(file, { api: api as any }) as any
    uploader.sessionId = 22
    uploader.phase = 'uploading'
    uploader.abortController = new AbortController()
    uploader.hashWorker = { terminate: vi.fn() }
    uploader.chunkHashWorker = { terminate: vi.fn() }

    await uploader.cancel()

    expect(api.abort).toHaveBeenCalledWith(22, { signal: expect.any(AbortSignal) })
    expect(uploader.phase).toBe('aborted')
    expect(uploader.hashWorker).toBeUndefined()
    expect(uploader.chunkHashWorker).toBeUndefined()
    expect(await uploader.getSessionId()).toBeUndefined()
  })

  it('emits file-mismatch when resuming with different file size', async () => {
    const file = new File(['abc'], 'resume.bin')
    const api = buildApi()
    api.status.mockResolvedValue({
      status: 'UPLOADING',
      uploaded_chunks: [],
      file_sha256: 'file-hash',
      total_size: file.size + 1,
      chunk_size: 2,
      total_chunks: 2,
      expires_at: '2026-01-01',
    })

    const uploader = new ShionlibLargeFileUploader(file, { api: api as any }) as any

    const events: any[] = []
    uploader.on((e: any) => events.push(e))

    await uploader.resumeFromSession(77)

    expect(api.status).toHaveBeenCalledWith(77, { signal: expect.any(AbortSignal) })
    expect(events).toContainEqual({ type: 'file-mismatch', sessionId: 77 })
    expect(events.some(e => e.type === 'error')).toBe(false)
  })

  it('computes uploaded size and hex helper output', () => {
    const file = new File(['abcdefghi'], 'size.bin') // 9 bytes
    const uploader = new ShionlibLargeFileUploader(file, { api: buildApi() as any }) as any

    uploader.chunkSize = 4
    uploader.totalChunks = 3
    uploader.uploaded = new Set([0, 2])

    expect(uploader.uploadedSize()).toBe(5)
    expect(uploader.toHex(new Uint8Array([0, 15, 255]))).toBe('000fff')
  })
})
