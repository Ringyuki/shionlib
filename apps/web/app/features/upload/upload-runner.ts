import type { ChunkUpload } from '~/shared/api/chunk'
import type { UploadSession, WaitReason } from './upload'
import { chunkLength, stallTimeout } from './upload'
import { retrying, stalledConnection, type Waiting } from './upload-failure'
import type { Slots } from './upload-slots'

export type RunnerEvent =
  | { type: 'progress'; sent: number; speed: number }
  | { type: 'waiting'; reason: WaitReason }
  | { type: 'running' }

export type RunnerDeps = {
  file: Blob
  session: UploadSession
  stored: ReadonlySet<number>
  hasher: { chunkDigest: (index: number) => Promise<string>; fileDigest: () => Promise<string> }
  slots: Slots
  send: (upload: ChunkUpload) => Promise<unknown>
  complete: (digest: string) => Promise<void>
  report: (event: RunnerEvent) => void
  now: () => number
  random: () => number
}

const reportInterval = 500

export class UploadRunner {
  private readonly deps: RunnerDeps
  private readonly sending = new Map<number, number>()
  private confirmed = 0
  private lastReport = { at: 0, bytes: 0 }
  private speed = 0

  constructor(deps: RunnerDeps) {
    this.deps = deps
    for (const index of deps.stored) {
      this.confirmed += this.lengthOf(index)
    }
  }

  async run(signal: AbortSignal): Promise<void> {
    const failure = new AbortController()
    const scope = AbortSignal.any([signal, failure.signal])
    const sending = new Set<Promise<void>>()
    let first: unknown
    const stop = (error: unknown) => {
      first ??= error
      failure.abort(error)
    }
    try {
      for (let index = 0; index < this.deps.session.totalChunks; index++) {
        if (this.deps.stored.has(index)) {
          continue
        }
        await this.deps.slots.acquire(scope)
        const task: Promise<void> = this.sendChunk(index, scope)
          .catch(stop)
          .finally(() => {
            this.deps.slots.release()
            sending.delete(task)
          })
        sending.add(task)
      }
    } catch (error) {
      stop(error)
    }
    await Promise.all(sending)
    if (first !== undefined) {
      throw first
    }
    const digest = await this.deps.hasher.fileDigest()
    await retrying(scope, () => this.deps.complete(digest), this.waiting())
  }

  private async sendChunk(index: number, scope: AbortSignal) {
    const sha256 = await this.deps.hasher.chunkDigest(index)
    const start = index * this.deps.session.chunkSize
    const content = this.deps.file.slice(start, start + this.lengthOf(index))
    await retrying(
      scope,
      async () => {
        const stall = new AbortController()
        let timer = setTimeout(() => stall.abort(stalledConnection()), stallTimeout)
        try {
          await this.deps.send({
            id: this.deps.session.id,
            index,
            content,
            sha256,
            signal: AbortSignal.any([scope, stall.signal]),
            onProgress: sent => {
              clearTimeout(timer)
              timer = setTimeout(() => stall.abort(stalledConnection()), stallTimeout)
              this.track(index, sent)
            },
          })
          this.sending.delete(index)
          this.confirmed += this.lengthOf(index)
          this.emitProgress(true)
        } catch (error) {
          this.track(index, 0)
          throw error
        } finally {
          clearTimeout(timer)
        }
      },
      this.waiting(),
    )
  }

  private waiting(): Waiting {
    return {
      wait: reason => this.deps.report({ type: 'waiting', reason }),
      resume: () => this.deps.report({ type: 'running' }),
      random: this.deps.random,
    }
  }

  private track(index: number, sent: number) {
    this.sending.set(index, sent)
    this.emitProgress(false)
  }

  private emitProgress(force: boolean) {
    const now = this.deps.now()
    const bytes = this.confirmed + [...this.sending.values()].reduce((sum, sent) => sum + sent, 0)
    const elapsed = now - this.lastReport.at
    if (!force && elapsed < reportInterval) {
      return
    }
    if (elapsed > 0 && this.lastReport.at > 0) {
      const current = ((bytes - this.lastReport.bytes) * 1000) / elapsed
      this.speed = this.speed === 0 ? current : this.speed * 0.7 + current * 0.3
    }
    this.lastReport = { at: now, bytes }
    this.deps.report({ type: 'progress', sent: bytes, speed: Math.max(0, this.speed) })
  }

  private lengthOf(index: number) {
    return chunkLength(this.deps.session, this.deps.file.size, index)
  }
}
