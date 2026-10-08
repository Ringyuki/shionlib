import type { FileHasher } from './file-hasher'
import type { UploadState } from './upload'
import { chunkSlots } from './upload'
import { failureOf, HeldElsewhere, spoilsSession, stopped } from './upload-failure'
import { Slots } from './upload-slots'
import { findUpload, type UploadEvent } from './upload-state'
import { transfer, type TransferContext, type UploadDeps } from './upload-transfer'

export type RunsQueue = {
  state: () => UploadState
  dispatch: (event: UploadEvent) => void
  advance: () => void
  discard: (upload: string) => void
}

const otherTabDelay = 30_000

export class UploadRuns {
  private readonly deps: UploadDeps
  private readonly queue: RunsQueue
  private readonly context: TransferContext
  private readonly files = new Map<string, File>()
  private readonly running = new Map<string, AbortController>()
  private readonly hashers = new Map<string, FileHasher>()

  constructor(deps: UploadDeps, queue: RunsQueue) {
    this.deps = deps
    this.queue = queue
    this.context = {
      deps,
      slots: new Slots(chunkSlots),
      hashers: this.hashers,
      dispatch: queue.dispatch,
    }
  }

  hasFile = (upload: string) => this.files.has(upload)

  keep(upload: string, file: File) {
    this.files.set(upload, file)
  }

  stop(upload: string) {
    this.running.get(upload)?.abort(stopped())
  }

  forget(upload: string) {
    this.files.delete(upload)
    this.hashers.get(upload)?.dispose()
    this.hashers.delete(upload)
  }

  dispose() {
    this.running.forEach(controller => controller.abort(stopped()))
    this.running.clear()
    this.hashers.forEach(hasher => hasher.dispose())
    this.hashers.clear()
  }

  settle() {
    const phaseOf = (upload: string) => findUpload(this.queue.state(), upload)?.phase.name
    for (const [upload, controller] of this.running) {
      const phase = phaseOf(upload)
      if (phase === undefined || phase === 'heldElsewhere') {
        controller.abort(stopped())
      }
    }
    for (const upload of [...this.files.keys()]) {
      const phase = phaseOf(upload)
      if (phase === undefined) {
        this.forget(upload)
      } else if (phase === 'needsFile') {
        this.queue.dispatch({ type: 'fileFound', upload })
      }
    }
  }

  async run(id: string) {
    const upload = findUpload(this.queue.state(), id)
    const file = this.files.get(id)
    if (upload === undefined || file === undefined) {
      return
    }
    const controller = new AbortController()
    this.running.set(id, controller)
    this.queue.dispatch({ type: 'started', upload: id })
    try {
      if (await transfer(this.context, upload, file, controller.signal)) {
        this.forget(id)
        this.queue.dispatch({ type: 'finished', upload: id })
      } else {
        this.queue.dispatch({ type: 'waiting', upload: id, reason: 'otherTab' })
        this.deps.later(() => this.retryOtherTab(id), otherTabDelay)
      }
    } catch (error) {
      this.fail(id, error)
    } finally {
      this.running.delete(id)
      this.queue.advance()
    }
  }

  private retryOtherTab(id: string) {
    const phase = findUpload(this.queue.state(), id)?.phase
    if (phase?.name === 'waiting' && phase.reason === 'otherTab') {
      this.queue.dispatch({ type: 'resumed', upload: id })
      this.queue.advance()
    }
  }

  private fail(id: string, error: unknown) {
    if (error instanceof HeldElsewhere) {
      this.queue.dispatch({ type: 'heldElsewhere', upload: id })
      return
    }
    const failure = failureOf(error)
    if (failure === undefined) {
      return
    }
    if (spoilsSession(failure)) {
      this.queue.discard(id)
    }
    this.forget(id)
    this.queue.dispatch({
      type: 'failed',
      upload: id,
      reason: failure.reason,
      message: failure.detail,
    })
  }
}
