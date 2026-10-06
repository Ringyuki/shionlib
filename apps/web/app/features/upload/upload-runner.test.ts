import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChunkUpload } from '~/shared/api/chunk'
import { ApiError } from '~/shared/api/error'
import { stopped, UploadFailure } from './upload-failure'
import { UploadRunner, type RunnerDeps, type RunnerEvent } from './upload-runner'
import { Slots } from './upload-slots'

const session = { id: 5, chunkSize: 4, totalChunks: 3 }

function setup(send: (upload: ChunkUpload) => Promise<unknown>, stored: number[] = []) {
  const events: RunnerEvent[] = []
  const complete = vi.fn(async () => undefined)
  const deps: RunnerDeps = {
    file: new Blob(['0123456789']),
    session,
    stored: new Set(stored),
    hasher: { chunkDigest: async index => `d${index}`, fileDigest: async () => 'whole' },
    slots: new Slots(2),
    send,
    complete,
    report: event => events.push(event),
    now: () => Date.now(),
    random: () => 0,
  }
  return { runner: new UploadRunner(deps), events, complete }
}

function hanging(upload: ChunkUpload): Promise<unknown> {
  return new Promise((_resolve, reject) => {
    upload.signal?.throwIfAborted()
    upload.signal?.addEventListener('abort', () => reject(upload.signal?.reason))
  })
}

const conflict = (code: number) =>
  new ApiError(409, { code, message: 'x', data: { errors: null }, requestId: '', timestamp: '' })

afterEach(() => {
  vi.useRealTimers()
})

describe('UploadRunner', () => {
  it('sends the missing chunks with their digests, then completes', async () => {
    const sent: ChunkUpload[] = []
    const { runner, events, complete } = setup(async upload => sent.push(upload), [1])
    await runner.run(new AbortController().signal)
    expect(
      sent.map(upload => [upload.id, upload.index, upload.sha256, upload.content.size]),
    ).toEqual([
      [5, 0, 'd0', 4],
      [5, 2, 'd2', 2],
    ])
    expect(complete).toHaveBeenCalledWith('whole')
    expect(events.at(-1)).toMatchObject({ type: 'progress', sent: 10 })
  })

  it('waits and sends again after a network failure', async () => {
    vi.useFakeTimers()
    let failed = false
    const { runner, events, complete } = setup(async () => {
      if (!failed) {
        failed = true
        throw new TypeError('offline')
      }
    }, [1, 2])
    const running = runner.run(new AbortController().signal)
    await vi.advanceTimersByTimeAsync(1_000)
    await running
    expect(events.filter(event => event.type !== 'progress')).toEqual([
      { type: 'waiting', reason: 'network' },
      { type: 'running' },
    ])
    expect(complete).toHaveBeenCalledOnce()
  })

  it('fails when the server holds a different file', async () => {
    const { runner, complete } = setup(async () => Promise.reject(conflict(480107)))
    const error = await runner.run(new AbortController().signal).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(UploadFailure)
    expect(error).toMatchObject({ reason: 'differentFile' })
    expect(complete).not.toHaveBeenCalled()
  })

  it('stops every chunk when paused', async () => {
    const { runner, complete } = setup(hanging)
    const controller = new AbortController()
    const running = runner.run(controller.signal)
    controller.abort(stopped())
    await expect(running).rejects.toMatchObject({ name: 'AbortError' })
    expect(complete).not.toHaveBeenCalled()
  })

  it('sends a stalled chunk again', async () => {
    vi.useFakeTimers()
    let attempts = 0
    const { runner, complete } = setup(
      upload => (++attempts === 1 ? hanging(upload) : Promise.resolve()),
      [1, 2],
    )
    const running = runner.run(new AbortController().signal)
    await vi.advanceTimersByTimeAsync(62_000)
    await running
    expect(attempts).toBe(2)
    expect(complete).toHaveBeenCalledOnce()
  })
})
