import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const hasher = {
    init: vi.fn(),
    update: vi.fn(),
    digest: vi.fn(() => 'chunk-digest'),
  }
  return {
    hasher,
    createSHA256: vi.fn(async () => hasher),
  }
})

vi.mock('hash-wasm', () => ({
  createSHA256: hoisted.createSHA256,
}))

describe('libs/uploader/worker/chunk-hash.worker (unit)', () => {
  beforeEach(() => {
    vi.resetModules()
    hoisted.createSHA256.mockClear()
    hoisted.hasher.init.mockClear()
    hoisted.hasher.update.mockClear()
    hoisted.hasher.digest.mockClear()
  })

  it('handles chunk-hash message and posts digest', async () => {
    const selfMock = {
      postMessage: vi.fn(),
      onmessage: undefined as any,
    }
    ;(globalThis as any).self = selfMock

    await import('../../../../libs/uploader/worker/chunk-hash.worker')

    await selfMock.onmessage({
      data: {
        type: 'chunk-hash',
        id: 3,
        buffer: new Uint8Array([1, 2, 3]).buffer,
      },
    })

    expect(hoisted.createSHA256).toHaveBeenCalledTimes(1)
    expect(hoisted.hasher.init).toHaveBeenCalledTimes(1)
    expect(selfMock.postMessage).toHaveBeenCalledWith({
      type: 'chunk-hash-complete',
      id: 3,
      digest: 'chunk-digest',
    })
  })

  it('posts chunk-hash-error when hashing fails', async () => {
    hoisted.createSHA256.mockImplementationOnce(async () => {
      throw new Error('hash failed')
    })

    const selfMock = {
      postMessage: vi.fn(),
      onmessage: undefined as any,
    }
    ;(globalThis as any).self = selfMock

    await import('../../../../libs/uploader/worker/chunk-hash.worker')

    await selfMock.onmessage({
      data: {
        type: 'chunk-hash',
        id: 8,
        buffer: new Uint8Array([9]).buffer,
      },
    })

    expect(selfMock.postMessage).toHaveBeenCalledWith({
      type: 'chunk-hash-error',
      id: 8,
      error: {
        name: 'Error',
        message: 'hash failed',
      },
    })
  })
})
