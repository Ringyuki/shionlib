import { describe, expect, it } from 'vitest'
import type {
  Phase,
  UploaderEvents,
  UploaderOptions,
  HashWorkerRequest,
  HashWorkerResponse,
  ChunkHashWorkerRequest,
  ChunkHashWorkerResponse,
  InitResp,
  StatusResp,
} from '../../../../libs/uploader/types'

describe('libs/uploader/types (unit)', () => {
  it('keeps uploader type contracts usable from barrel export', () => {
    const phase: Phase = 'uploading'

    const event: UploaderEvents = {
      type: 'progress',
      bytesUploaded: 10,
      totalBytes: 100,
      speedBps: 20,
      etaSec: 5,
    }

    const options: UploaderOptions = {
      concurrency: 2,
      retry: {
        retries: 3,
        baseDelayMs: 100,
        maxDelayMs: 1000,
      },
      desiredChunkSize: 1024,
      smallFileThreshold: 2048,
    }

    const hashReq: HashWorkerRequest = {
      type: 'hash',
      file: new File(['abc'], 'a.bin'),
      step: 1024,
    }
    const hashResp: HashWorkerResponse = {
      type: 'hash-complete',
      digest: 'abc',
    }

    const chunkReq: ChunkHashWorkerRequest = {
      type: 'chunk-hash',
      id: 1,
      buffer: new Uint8Array([1, 2]).buffer,
    }
    const chunkResp: ChunkHashWorkerResponse = {
      type: 'chunk-hash-complete',
      id: 1,
      digest: 'def',
    }

    const init: InitResp = {
      upload_session_id: 1,
      chunk_size: 1024,
      total_chunks: 3,
      expires_at: '2026-01-01',
    }
    const status: StatusResp = {
      status: 'UPLOADING',
      uploaded_chunks: [0],
      file_sha256: 'abc',
      total_size: 3,
      chunk_size: 1,
      total_chunks: 3,
      expires_at: '2026-01-01',
    }

    expect(phase).toBe('uploading')
    expect(event.type).toBe('progress')
    expect(options.retry?.retries).toBe(3)
    expect(hashReq.type).toBe('hash')
    expect(hashResp.type).toBe('hash-complete')
    expect(chunkReq.type).toBe('chunk-hash')
    expect(chunkResp.type).toBe('chunk-hash-complete')
    expect(init.upload_session_id).toBe(1)
    expect(status.status).toBe('UPLOADING')
  })
})
