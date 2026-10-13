import { describe, expect, it } from 'vitest'
import { FileHasher, type HashWorker } from './file-hasher'
import { hashFile } from './upload-hash'
import type { HashReport } from './upload.schema'

function inProcess(): HashWorker & { stopped: () => boolean } {
  let stopped = false
  return {
    start: (file, chunkSize, receive) => void hashFile(file, chunkSize, receive),
    terminate: () => {
      stopped = true
    },
    stopped: () => stopped,
  }
}

function scripted(reports: HashReport[]): HashWorker {
  return {
    start: (_file, _size, receive) => queueMicrotask(() => reports.forEach(receive)),
    terminate: () => undefined,
  }
}

describe('FileHasher', () => {
  it('hands out chunk digests as soon as they are known, then the whole file', async () => {
    const hasher = new FileHasher(inProcess(), new Blob(['0123456789']), 4)
    await expect(hasher.chunkDigest(2)).resolves.toMatch(/^[0-9a-f]{64}$/)
    await expect(hasher.fileDigest()).resolves.toMatch(/^[0-9a-f]{64}$/)
    await expect(hasher.chunkDigest(0)).resolves.toMatch(/^[0-9a-f]{64}$/)
  })

  it('fails every waiter when the worker fails', async () => {
    const hasher = new FileHasher(
      scripted([
        { kind: 'chunk', index: 0, sha256: 'a' },
        { kind: 'error', message: 'unreadable' },
      ]),
      new Blob(['x']),
      4,
    )
    await expect(hasher.chunkDigest(0)).resolves.toBe('a')
    await expect(hasher.fileDigest()).rejects.toThrow('unreadable')
  })

  it('stops the worker and the waiters when disposed', async () => {
    const worker = inProcess()
    const hasher = new FileHasher({ ...worker, start: () => undefined }, new Blob(['x']), 4)
    const waiting = hasher.fileDigest()
    hasher.dispose()
    await expect(waiting).rejects.toThrow('disposed')
    expect(worker.stopped()).toBe(true)
  })
})
