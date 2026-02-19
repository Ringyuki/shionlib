import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const hasher = {
    init: vi.fn(),
    update: vi.fn(),
    digest: vi.fn(() => 'file-digest'),
  }
  return {
    hasher,
    createBLAKE3: vi.fn(async () => hasher),
  }
})

vi.mock('hash-wasm', () => ({
  createBLAKE3: hoisted.createBLAKE3,
}))

describe('libs/uploader/worker/hash.worker (unit)', () => {
  beforeEach(() => {
    vi.resetModules()
    hoisted.createBLAKE3.mockClear()
    hoisted.hasher.init.mockClear()
    hoisted.hasher.update.mockClear()
    hoisted.hasher.digest.mockClear()
  })

  it('hashes file in steps and posts progress + completion', async () => {
    const selfMock = {
      postMessage: vi.fn(),
      onmessage: undefined as any,
    }
    ;(globalThis as any).self = selfMock

    await import('../../../../libs/uploader/worker/hash.worker')

    const file = new File(['abcd'], 'a.bin')
    await selfMock.onmessage({
      data: {
        type: 'hash',
        file,
        step: 2,
      },
    })

    expect(hoisted.createBLAKE3).toHaveBeenCalledTimes(1)
    expect(hoisted.hasher.init).toHaveBeenCalledTimes(1)
    expect(hoisted.hasher.update).toHaveBeenCalledTimes(2)
    expect(selfMock.postMessage).toHaveBeenCalledWith({
      type: 'hash-complete',
      digest: 'file-digest',
    })

    const progressCalls = selfMock.postMessage.mock.calls.filter(
      (call: any[]) => call[0]?.type === 'hash-progress',
    )
    expect(progressCalls).toHaveLength(2)
  })

  it('posts hash-error on worker failure', async () => {
    hoisted.createBLAKE3.mockImplementationOnce(async () => {
      throw new Error('blake failed')
    })

    const selfMock = {
      postMessage: vi.fn(),
      onmessage: undefined as any,
    }
    ;(globalThis as any).self = selfMock

    await import('../../../../libs/uploader/worker/hash.worker')

    await selfMock.onmessage({
      data: {
        type: 'hash',
        file: new File(['x'], 'x.bin'),
        step: 1,
      },
    })

    expect(selfMock.postMessage).toHaveBeenCalledWith({
      type: 'hash-error',
      error: {
        name: 'Error',
        message: 'blake failed',
      },
    })
  })
})
